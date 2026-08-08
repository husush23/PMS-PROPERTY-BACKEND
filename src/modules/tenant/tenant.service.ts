import {
  Injectable,
  HttpStatus,
  forwardRef,
  Inject,
  Logger,
} from '@nestjs/common';
import {
  BusinessException,
  ErrorCode,
} from '../../common/exceptions/business.exception';
import { ERROR_MESSAGES } from '../../common/constants/error-messages.constant';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { TenantProfile } from './entities/tenant-profile.entity';
import { TenantInvitation } from './entities/tenant-invitation.entity';
import { User } from '../user/entities/user.entity';
import { Company } from '../company/entities/company.entity';
import { UserCompany } from '../company/entities/user-company.entity';
import { Lease } from '../lease/entities/lease.entity';
import { Unit } from '../unit/entities/unit.entity';
import { Property } from '../property/entities/property.entity';
import { RentCycle } from '../rent-cycle/entities/rent-cycle.entity';
import { Payment } from '../payment/entities/payment.entity';
import { CompanySettingsService } from '../company/company-settings.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { InviteTenantDto } from './dto/invite-tenant.dto';
import { AcceptTenantInviteDto } from './dto/accept-tenant-invite.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantResponseDto } from './dto/tenant-response.dto';
import { TenantListItemDto } from './dto/tenant-list-item.dto';
import {
  TenantDetailsResponseDto,
  TenantActiveLeaseSummaryDto,
  TenantFinancialSummaryDto,
} from './dto/tenant-details-response.dto';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto';
import { UserRole } from '../../shared/enums/user-role.enum';
import { TenantStatus } from '../../shared/enums/tenant-status.enum';
import { LeaseStatus } from '../../shared/enums/lease-status.enum';
import { PaymentStatus } from '../../shared/enums/payment-status.enum';
import { InvitationStatus } from '../company/entities/company-invitation.entity';
import { PasswordUtil } from '../../common/utils/password.util';
import { NotificationService } from '../notification/notification.service';
import { UserService } from '../user/user.service';
import { CompanyService } from '../company/company.service';
import { CompanySettingsResolver } from '../company/company-settings-resolver.service';
import { randomUUID } from 'crypto';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    @InjectRepository(TenantProfile)
    private tenantProfileRepository: Repository<TenantProfile>,
    @InjectRepository(TenantInvitation)
    private tenantInvitationRepository: Repository<TenantInvitation>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
    @InjectRepository(UserCompany)
    private userCompanyRepository: Repository<UserCompany>,
    @InjectRepository(Lease)
    private leaseRepository: Repository<Lease>,
    @InjectRepository(Unit)
    private unitRepository: Repository<Unit>,
    @InjectRepository(Property)
    private propertyRepository: Repository<Property>,
    @InjectRepository(RentCycle)
    private rentCycleRepository: Repository<RentCycle>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    private readonly companySettingsService: CompanySettingsService,
    private notificationService: NotificationService,
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
    @Inject(forwardRef(() => CompanyService))
    private companyService: CompanyService,
    private companySettingsResolver: CompanySettingsResolver,
  ) {}

  async inviteTenant(
    companyId: string,
    inviteDto: InviteTenantDto,
    requesterUserId: string,
  ): Promise<void> {
    // Permission check
    const requesterUser = await this.userRepository.findOne({
      where: { id: requesterUserId },
    });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    if (!isSuperAdmin) {
      const requester = await this.userCompanyRepository.findOne({
        where: {
          companyId,
          userId: requesterUserId,
          isActive: true,
        },
      });

      if (
        !requester ||
        ![UserRole.COMPANY_ADMIN, UserRole.MANAGER].includes(requester.role)
      ) {
        throw new BusinessException(
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          'Only company administrators and managers can invite tenants.',
          HttpStatus.FORBIDDEN,
          { requiredRoles: [UserRole.COMPANY_ADMIN, UserRole.MANAGER] },
        );
      }
    }

    // Verify company exists
    const company = await this.companyRepository.findOne({
      where: { id: companyId },
    });
    if (!company) {
      throw new BusinessException(
        ErrorCode.COMPANY_NOT_FOUND,
        ERROR_MESSAGES.COMPANY_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { companyId },
      );
    }

    // Check if user exists by email or phone
    let user: User | null = null;
    
    if (inviteDto.email) {
      user = await this.userRepository.findOne({
        where: { email: inviteDto.email.toLowerCase() },
      });
    }
    
    if (!user) {
      user = await this.userRepository.findOne({
        where: { phone: inviteDto.phone },
      });
    }

    // Check if user is already a tenant in this company
    if (user) {
      const existingTenantProfile = await this.tenantProfileRepository.findOne({
        where: { userId: user.id, companyId },
      });
      if (existingTenantProfile) {
        throw new BusinessException(
          ErrorCode.TENANT_ALREADY_EXISTS,
          ERROR_MESSAGES.TENANT_ALREADY_EXISTS,
          HttpStatus.CONFLICT,
          { phone: inviteDto.phone, companyId },
        );
      }
    } else {
      // Create user with inactive status and temporary password (invitation flow)
      const tempPassword = randomUUID();
      const hashedPassword = await PasswordUtil.hash(tempPassword);

      user = this.userRepository.create({
        email: inviteDto.email ? inviteDto.email.toLowerCase() : undefined,
        password: hashedPassword,
        name: undefined, // Name will be set when tenant accepts invitation
        isActive: false,
        emailVerified: false, // Not verified until invitation accepted
        phone: inviteDto.phone,
      });
      user = await this.userRepository.save(user);
    }

    const companySettings =
      await this.companySettingsResolver.getSettings(companyId);

    // Create minimal TenantProfile with PENDING status
    // Profile data will be collected when tenant accepts the invitation
    const tenantProfile = this.tenantProfileRepository.create({
      userId: user.id,
      companyId,
      status: TenantStatus.PENDING,
      phone: inviteDto.phone,
      // Company settings = system behavior defaults.
      // Overrides allowed at transaction/lease level only.
      emailNotifications: companySettings.defaultEmailNotifications,
      smsNotifications: companySettings.defaultSmsNotifications,
    });

    const savedTenantProfile =
      await this.tenantProfileRepository.save(tenantProfile);

    // Create or ensure UserCompany relationship with TENANT role
    // Check if relationship already exists (user might be tenant at multiple companies)
    const existingUserCompany = await this.userCompanyRepository.findOne({
      where: { userId: user.id, companyId },
    });

    if (!existingUserCompany) {
      // Create UserCompany relationship if it doesn't exist
      await this.companyService.assignUserToCompany(
        user.id,
        companyId,
        UserRole.TENANT,
      );
    } else if (existingUserCompany.role !== UserRole.TENANT) {
      // If relationship exists but with different role, update to TENANT
      await this.userCompanyRepository.update(existingUserCompany.id, {
        role: UserRole.TENANT,
        isActive: true,
      });
    } else {
      // Relationship already exists with TENANT role, ensure it's active
      if (!existingUserCompany.isActive) {
        await this.userCompanyRepository.update(existingUserCompany.id, {
          isActive: true,
        });
      }
    }

    // Create TenantInvitation
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = this.tenantInvitationRepository.create({
      email: inviteDto.email ? inviteDto.email.toLowerCase() : undefined,
      companyId,
      tenantProfileId: savedTenantProfile.id,
      token,
      status: InvitationStatus.PENDING,
      expiresAt,
      invitedBy: requesterUserId,
    });

    await this.tenantInvitationRepository.save(invitation);

    // Send invitation email if email is provided
    if (inviteDto.email) {
      const inviterName =
        requesterUser?.name || requesterUser?.email || 'Someone';
      this.notificationService
        .sendTenantInvitationEmail(
          inviteDto.email,
          company.name,
          token,
          inviterName,
        )
        .catch((error) => {
          this.logger.error('Failed to send tenant invitation email', error);
        });
    }
  }

  async acceptTenantInvitation(
    acceptDto: AcceptTenantInviteDto,
  ): Promise<void> {
    const invitation = await this.tenantInvitationRepository.findOne({
      where: { token: acceptDto.token },
      relations: ['company', 'tenantProfile'],
    });

    if (!invitation) {
      throw new BusinessException(
        ErrorCode.TENANT_INVITATION_NOT_FOUND,
        ERROR_MESSAGES.TENANT_INVITATION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { token: acceptDto.token },
      );
    }

    // Check invitation status
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new BusinessException(
        ErrorCode.TENANT_INVITATION_ALREADY_ACCEPTED,
        ERROR_MESSAGES.TENANT_INVITATION_ALREADY_ACCEPTED,
        HttpStatus.BAD_REQUEST,
        { token: acceptDto.token },
      );
    }

    if (
      invitation.status === InvitationStatus.CANCELLED ||
      invitation.status === InvitationStatus.EXPIRED
    ) {
      throw new BusinessException(
        ErrorCode.TENANT_INVITATION_EXPIRED,
        ERROR_MESSAGES.TENANT_INVITATION_EXPIRED,
        HttpStatus.BAD_REQUEST,
        { token: acceptDto.token },
      );
    }

    // Check if expired
    if (new Date() > invitation.expiresAt) {
      await this.tenantInvitationRepository.update(invitation.id, {
        status: InvitationStatus.EXPIRED,
      });
      throw new BusinessException(
        ErrorCode.TENANT_INVITATION_EXPIRED,
        ERROR_MESSAGES.TENANT_INVITATION_EXPIRED,
        HttpStatus.BAD_REQUEST,
        { token: acceptDto.token },
      );
    }

    // Find or create user for the invitation email
    let user = await this.userRepository.findOne({
      where: { email: invitation.email.toLowerCase() },
    });

    if (!user) {
      // User doesn't exist yet, create it with name from DTO
      const hashedPassword = await PasswordUtil.hash(acceptDto.password);
      user = this.userRepository.create({
        email: invitation.email.toLowerCase(),
        password: hashedPassword,
        name: acceptDto.name,
        isActive: true,
        emailVerified: true, // Verified when invitation accepted
        phone: acceptDto.phone,
      });
      user = await this.userRepository.save(user);

      // If tenant profile exists but was linked to a different user, update it
      if (invitation.tenantProfileId) {
        const tenantProfile = await this.tenantProfileRepository.findOne({
          where: { id: invitation.tenantProfileId },
        });
        if (tenantProfile && tenantProfile.userId !== user.id) {
          await this.tenantProfileRepository.update(tenantProfile.id, {
            userId: user.id,
          });
        }
      }
    } else {
      // User exists, update password, name (if provided), activate, and verify
      const hashedPassword = await PasswordUtil.hash(acceptDto.password);
      const updateData: Partial<User> = {
        password: hashedPassword,
        isActive: true,
        emailVerified: true, // Verify when invitation accepted
      };
      // Update name if provided (tenant may want to update their name)
      if (acceptDto.name) {
        updateData.name = acceptDto.name;
      }
      if (acceptDto.phone) {
        updateData.phone = acceptDto.phone;
      }
      await this.userRepository.update(user.id, updateData);
    }

    // Get or create tenant profile
    let tenantProfile = await this.tenantProfileRepository.findOne({
      where: { id: invitation.tenantProfileId },
    });

    // Prepare tenant profile data with all provided fields from DTO
    const companySettings =
      await this.companySettingsResolver.getSettings(invitation.companyId);

    const profileData: Partial<TenantProfile> = {
      userId: user.id,
      companyId: invitation.companyId,
      status: TenantStatus.PENDING,
      phone: acceptDto.phone,
      alternativePhone: acceptDto.alternativePhone,
      dateOfBirth: acceptDto.dateOfBirth
        ? new Date(acceptDto.dateOfBirth)
        : undefined,
      idNumber: acceptDto.idNumber,
      idType: acceptDto.idType,
      address: acceptDto.address,
      city: acceptDto.city,
      state: acceptDto.state,
      zipCode: acceptDto.zipCode,
      country: acceptDto.country,
      emergencyContactName: acceptDto.emergencyContactName,
      emergencyContactPhone: acceptDto.emergencyContactPhone,
      emergencyContactRelationship: acceptDto.emergencyContactRelationship,
      notes: acceptDto.notes,
      tags: acceptDto.tags,
      // Company settings = system behavior defaults.
      // Overrides allowed at transaction/lease level only.
      emailNotifications:
        acceptDto.emailNotifications ??
        companySettings.defaultEmailNotifications,
      smsNotifications:
        acceptDto.smsNotifications ?? companySettings.defaultSmsNotifications,
    };

    // Remove undefined values to avoid overwriting with null
    Object.keys(profileData).forEach((key) => {
      if (profileData[key as keyof TenantProfile] === undefined) {
        delete profileData[key as keyof TenantProfile];
      }
    });

    if (!tenantProfile) {
      // Create tenant profile if it doesn't exist
      tenantProfile = this.tenantProfileRepository.create(profileData);
      await this.tenantProfileRepository.save(tenantProfile);
    } else {
      // Update existing tenant profile
      await this.tenantProfileRepository.update(tenantProfile.id, profileData);
    }

    // Ensure UserCompany relationship exists
    const existingUserCompany = await this.userCompanyRepository.findOne({
      where: {
        userId: user.id,
        companyId: invitation.companyId,
      },
    });

    if (!existingUserCompany) {
      await this.companyService.assignUserToCompany(
        user.id,
        invitation.companyId,
        UserRole.TENANT,
      );
    }

    // Mark invitation as accepted
    await this.tenantInvitationRepository.update(invitation.id, {
      status: InvitationStatus.ACCEPTED,
      acceptedAt: new Date(),
    });
  }

  async create(
    companyId: string,
    createDto: CreateTenantDto,
    requesterUserId: string,
  ): Promise<{ tenant: TenantResponseDto; userAlreadyExisted: boolean }> {
    // Permission check
    const requesterUser = await this.userRepository.findOne({
      where: { id: requesterUserId },
    });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    if (!isSuperAdmin) {
      const requester = await this.userCompanyRepository.findOne({
        where: {
          companyId,
          userId: requesterUserId,
          isActive: true,
        },
      });

      if (
        !requester ||
        ![UserRole.COMPANY_ADMIN, UserRole.MANAGER].includes(requester.role)
      ) {
        throw new BusinessException(
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          'Only company administrators and managers can create tenants.',
          HttpStatus.FORBIDDEN,
          { requiredRoles: [UserRole.COMPANY_ADMIN, UserRole.MANAGER] },
        );
      }
    }

    const companySettings =
      await this.companySettingsResolver.getSettings(companyId);

    // Verify company exists
    const company = await this.companyRepository.findOne({
      where: { id: companyId },
    });
    if (!company) {
      throw new BusinessException(
        ErrorCode.COMPANY_NOT_FOUND,
        ERROR_MESSAGES.COMPANY_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { companyId },
      );
    }

    // Check if user exists by email or phone
    let user: User | null = null;
    
    if (createDto.email) {
      const normalizedEmail = createDto.email.toLowerCase().trim();
      user = await this.userRepository
        .createQueryBuilder('user')
        .where('LOWER(user.email) = LOWER(:email)', { email: normalizedEmail })
        .getOne();
    }
    
    if (!user) {
      user = await this.userRepository.findOne({
        where: { phone: createDto.phone }
      });
    }

    let userAlreadyExisted = false;

    if (!user) {
      // User doesn't exist - create user with password (password is required for direct creation)
      // Password provided: create active and verified user
      const hashedPassword = await PasswordUtil.hash(createDto.password);

      user = this.userRepository.create({
        email: createDto.email ? createDto.email.toLowerCase().trim() : undefined,
        password: hashedPassword,
        name: createDto.name,
        isActive: true, // Active immediately
        emailVerified: !!createDto.email, // Verified if email exists
        phone: createDto.phone,
      });
      user = await this.userRepository.save(user);
    } else {
      // User exists - DO NOT modify ANY existing user information
      // Preserve ALL existing user data (password, name, emailVerified, isActive, etc.)
      // Just create tenant profile for this company
      userAlreadyExisted = true;

      // Save original user data for verification and protection
      const originalUserData = {
        name: user.name,
        email: user.email,
        password: user.password,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
      };

      // Reload user from database with explicit field selection to avoid any mutations
      const refreshedUser = await this.userRepository.findOne({
        where: { id: user.id },
        select: [
          'id',
          'email',
          'password',
          'name',
          'isActive',
          'emailVerified',
          'isSuperAdmin',
          'createdAt',
          'updatedAt',
        ],
      });

      const logEmail = createDto.email || createDto.phone;
      if (!refreshedUser) {
        throw new BusinessException(
          ErrorCode.USER_NOT_FOUND,
          `User with email/phone ${logEmail} was found but could not be reloaded. Please try again.`,
          HttpStatus.INTERNAL_SERVER_ERROR,
          { identifier: logEmail },
        );
      }

      user = refreshedUser;

      // Verify original data integrity - if something changed, restore it
      if (user.name !== originalUserData.name) {
        // Something modified the name - restore original
        this.logger.warn(
          `[TENANT CREATE] User name was unexpectedly modified from "${originalUserData.name}" to "${user.name}". Restoring original name for user ${user.id}.`,
        );
        await this.userRepository.update(user.id, { name: originalUserData.name });
        user.name = originalUserData.name;
      }

      // Ensure no other fields were modified
      if (
        user.email !== originalUserData.email ||
        user.isActive !== originalUserData.isActive ||
        user.emailVerified !== originalUserData.emailVerified
      ) {
        // Restore all original data
        this.logger.warn(
          `[TENANT CREATE] User data was unexpectedly modified for user ${user.id}. Restoring original values. email=${user.email} isActive=${user.isActive} emailVerified=${user.emailVerified}`,
        );
        await this.userRepository.update(user.id, {
          email: originalUserData.email,
          isActive: originalUserData.isActive,
          emailVerified: originalUserData.emailVerified,
        });
        // Reload again
        const restoredUser = await this.userRepository.findOne({
          where: { id: user.id },
          select: [
            'id',
            'email',
            'password',
            'name',
            'isActive',
            'emailVerified',
            'isSuperAdmin',
            'createdAt',
            'updatedAt',
          ],
        });
        if (!restoredUser) {
          throw new BusinessException(
            ErrorCode.USER_NOT_FOUND,
            `User ${user.id} could not be restored after data integrity check.`,
            HttpStatus.INTERNAL_SERVER_ERROR,
            { userId: user.id, identifier: logEmail },
          );
        }
        user = restoredUser;
      }

      // Log successful protection
      this.logger.log(
        `[TENANT CREATE] Existing user ${user.id} (${logEmail}) data protected: name="${originalUserData.name}", password preserved, isActive=${originalUserData.isActive}, emailVerified=${originalUserData.emailVerified}`,
      );
    }

    // Ensure user is not null at this point
    if (!user) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOUND,
        ERROR_MESSAGES.USER_NOT_FOUND,
        HttpStatus.INTERNAL_SERVER_ERROR,
        { email: createDto.email },
      );
    }

    // Check for duplicate tenant
    const existingTenantProfile = await this.tenantProfileRepository.findOne({
      where: { userId: user.id, companyId },
    });
    if (existingTenantProfile) {
      throw new BusinessException(
        ErrorCode.TENANT_ALREADY_EXISTS,
        ERROR_MESSAGES.TENANT_ALREADY_EXISTS,
        HttpStatus.CONFLICT,
        { email: createDto.email, companyId },
      );
    }

    // Create TenantProfile (status PENDING - no lease exists yet)
    // For existing users, create minimal profile - tenant can update their profile later
    // For new users, use the provided data
    const tenantProfileData: any = {
      userId: user.id,
      companyId,
      status: TenantStatus.PENDING,
      // Company settings = system behavior defaults.
      // Overrides allowed at transaction/lease level only.
      emailNotifications:
        createDto.emailNotifications ??
        companySettings.defaultEmailNotifications,
      smsNotifications:
        createDto.smsNotifications ?? companySettings.defaultSmsNotifications,
    };

    if (!userAlreadyExisted) {
      // New user - populate all provided fields
      tenantProfileData.phone = createDto.phone;
      tenantProfileData.alternativePhone = createDto.alternativePhone;
      tenantProfileData.dateOfBirth = createDto.dateOfBirth
        ? new Date(createDto.dateOfBirth)
        : undefined;
      tenantProfileData.idNumber = createDto.idNumber;
      tenantProfileData.idType = createDto.idType;
      tenantProfileData.address = createDto.address;
      tenantProfileData.city = createDto.city;
      tenantProfileData.state = createDto.state;
      tenantProfileData.zipCode = createDto.zipCode;
      tenantProfileData.country = createDto.country;
      tenantProfileData.emergencyContactName = createDto.emergencyContactName;
      tenantProfileData.emergencyContactPhone = createDto.emergencyContactPhone;
      tenantProfileData.emergencyContactRelationship =
        createDto.emergencyContactRelationship;
      tenantProfileData.notes = createDto.notes;
      tenantProfileData.tags = createDto.tags;
    } else {
      // Existing user - create minimal profile (no personal data)
      // Tenant will update their profile information themselves later
      // This protects existing user data and prevents accidental overwrites
      tenantProfileData.phone = null;
      tenantProfileData.alternativePhone = null;
      tenantProfileData.dateOfBirth = null;
      tenantProfileData.idNumber = null;
      tenantProfileData.idType = null;
      tenantProfileData.address = null;
      tenantProfileData.city = null;
      tenantProfileData.state = null;
      tenantProfileData.zipCode = null;
      tenantProfileData.country = null;
      tenantProfileData.emergencyContactName = null;
      tenantProfileData.emergencyContactPhone = null;
      tenantProfileData.emergencyContactRelationship = null;
      tenantProfileData.notes = null;
      tenantProfileData.tags = null;
    }

    const tenantProfile = this.tenantProfileRepository.create(tenantProfileData);

    const savedTenantProfile = await this.tenantProfileRepository.save(tenantProfile) as unknown as TenantProfile;

    // Create UserCompany relationship with TENANT role
    try {
      await this.companyService.assignUserToCompany(
        user.id,
        companyId,
        UserRole.TENANT,
      );
    } catch (error) {
      // If UserCompany assignment fails, clean up the tenant profile
      if (error instanceof BusinessException && (error as any).errorCode === ErrorCode.USER_ALREADY_IN_COMPANY) {
        // UserCompany relationship already exists - this is okay, user might be re-added
        // Continue with the flow
      } else {
        // Other errors - clean up tenant profile if it was just created
        if (savedTenantProfile) {
          try {
            await this.tenantProfileRepository.remove(savedTenantProfile);
          } catch (cleanupError) {
            // Log but don't throw - main error is more important
            this.logger.error(
              'Failed to cleanup tenant profile after UserCompany assignment failure',
              cleanupError,
            );
          }
        }
        // Re-throw the error with better context
        throw new BusinessException(
          ErrorCode.INTERNAL_SERVER_ERROR,
          `Failed to assign user to company: ${error.message || 'Unknown error'}. Tenant profile creation rolled back.`,
          HttpStatus.INTERNAL_SERVER_ERROR,
          { userId: user.id, companyId, originalError: error.message },
        );
      }
    }

    // For existing users, reload from database one more time after all operations
    // This ensures we return the actual saved data, not any cached or modified version
    if (userAlreadyExisted) {
      const finalUser = await this.userRepository.findOne({
        where: { id: user.id },
        select: [
          'id',
          'email',
          'password',
          'name',
          'isActive',
          'emailVerified',
          'isSuperAdmin',
          'createdAt',
          'updatedAt',
        ],
      });
      if (!finalUser) {
        throw new BusinessException(
          ErrorCode.USER_NOT_FOUND,
          `User with ID ${user.id} could not be found after tenant profile creation. Data integrity issue.`,
          HttpStatus.INTERNAL_SERVER_ERROR,
          { userId: user.id, identifier: createDto.email || createDto.phone },
        );
      }
      user = finalUser;
    }

    // Only send invitation email for newly created users who are inactive
    // Existing users should handle password reset themselves if needed
    if (!userAlreadyExisted && !user.isActive) {
      if (!savedTenantProfile.emailNotifications) {
        return {
          tenant: this.toResponseDto(savedTenantProfile, user, companyId),
          userAlreadyExisted,
        };
      }

      const token = randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = this.tenantInvitationRepository.create({
        email: createDto.email ? createDto.email.toLowerCase() : undefined,
        companyId,
        tenantProfileId: savedTenantProfile.id,
        token,
        status: InvitationStatus.PENDING,
        expiresAt,
        invitedBy: requesterUserId,
      });

      await this.tenantInvitationRepository.save(invitation);

      // Send invitation email if email is provided
      if (createDto.email) {
        const requesterUser = await this.userRepository.findOne({
          where: { id: requesterUserId },
        });
        const inviterName =
          requesterUser?.name || requesterUser?.email || 'Someone';
        this.notificationService
          .sendTenantInvitationEmail(
            createDto.email,
            company.name,
            token,
            inviterName,
          )
          .catch((error) => {
            this.logger.error('Failed to send tenant invitation email', error);
          });
      }
    }

    return {
      tenant: this.toResponseDto(savedTenantProfile, user, companyId),
      userAlreadyExisted,
    };
  }

  async findAll(
    companyId: string,
    queryDto: ListTenantsQueryDto,
    requesterUserId: string,
  ): Promise<{
    data: TenantListItemDto[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    // Permission check
    const requesterUser = await this.userRepository.findOne({
      where: { id: requesterUserId },
    });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    // Get requester's role in company (for tenant access check)
    const requesterUserCompany = await this.userCompanyRepository.findOne({
      where: { userId: requesterUserId, companyId, isActive: true },
    });

    const isTenant = requesterUserCompany?.role === UserRole.TENANT;

    // Tenants can only see themselves
    if (!isSuperAdmin && isTenant) {
      const tenantProfile = await this.tenantProfileRepository.findOne({
        where: { userId: requesterUserId, companyId },
        relations: ['user'],
      });

      if (!tenantProfile || !tenantProfile.user) {
        // Filter out orphaned tenant profiles (missing user)
        return {
          data: [],
          pagination: {
            total: 0,
            page: 1,
            limit: queryDto.limit || 10,
            totalPages: 0,
          },
        };
      }

      const userCompany = await this.userCompanyRepository.findOne({
        where: { userId: requesterUserId, companyId, isActive: true },
      });

      const leaseInfo = await this.getLeaseInfoForTenantUserId(
        tenantProfile.userId,
      );
      const base = this.toResponseDto(
        tenantProfile,
        tenantProfile.user,
        companyId,
        userCompany!,
      );
      const listItem: TenantListItemDto = {
        ...base,
        activeLeaseCount: leaseInfo.count,
        currentUnitNumber: leaseInfo.firstUnitNumber ?? null,
        currentPropertyName: leaseInfo.firstPropertyName ?? null,
      };

      return {
        data: [listItem],
        pagination: {
          total: 1,
          page: 1,
          limit: queryDto.limit || 10,
          totalPages: 1,
        },
      };
    }

    if (!isSuperAdmin) {
      // Verify requester is a member of the company (COMPANY_ADMIN or MANAGER)
      if (
        !requesterUserCompany ||
        ![UserRole.COMPANY_ADMIN, UserRole.MANAGER].includes(
          requesterUserCompany.role,
        )
      ) {
        throw new BusinessException(
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          'Only company administrators and managers can view tenants.',
          HttpStatus.FORBIDDEN,
          { requiredRoles: [UserRole.COMPANY_ADMIN, UserRole.MANAGER] },
        );
      }
    }

    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;
    const skip = (page - 1) * limit;

    // Build query - use innerJoin to filter out tenant profiles with missing users
    const queryBuilder = this.tenantProfileRepository
      .createQueryBuilder('tenantProfile')
      .innerJoinAndSelect('tenantProfile.user', 'user')
      .leftJoinAndSelect('tenantProfile.company', 'company')
      .where('tenantProfile.companyId = :companyId', { companyId });

    // Apply filters
    if (queryDto.search) {
      queryBuilder.andWhere(
        '(user.email ILIKE :search OR user.name ILIKE :search OR tenantProfile.phone ILIKE :search)',
        { search: `%${queryDto.search}%` },
      );
    }

    if (queryDto.status) {
      queryBuilder.andWhere('tenantProfile.status = :status', {
        status: queryDto.status,
      });
    }

    // Apply sorting
    const sortBy = queryDto.sortBy || 'createdAt';
    const sortOrder = queryDto.sortOrder || 'DESC';

    if (sortBy === 'name' || sortBy === 'email') {
      queryBuilder.orderBy(`user.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy(`tenantProfile.${sortBy}`, sortOrder);
    }

    // Get total count before pagination (excluding orphaned tenants via innerJoin)
    const total = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    const tenantProfiles = await queryBuilder.getMany();

    // Get UserCompany relationships for joinedAt and role
    const userIds = tenantProfiles.map((tp) => tp.userId);
    const userCompanies =
      userIds.length > 0
        ? await this.userCompanyRepository
            .createQueryBuilder('uc')
            .where('uc.userId IN (:...userIds)', { userIds })
            .andWhere('uc.companyId = :companyId', { companyId })
            .andWhere('uc.isActive = :isActive', { isActive: true })
            .getMany()
        : [];

    const userCompanyMap = new Map(userCompanies.map((uc) => [uc.userId, uc]));

    // Filter out any tenant profiles with null users (extra safety check)
    const validTenantProfiles = tenantProfiles.filter(
      (tp) => tp.user !== null && tp.user !== undefined,
    );

    const leaseInfoMap = new Map<
      string,
      { count: number; firstUnitNumber: string | null; firstPropertyName: string | null }
    >();
    if (validTenantProfiles.length > 0) {
      const userIds = validTenantProfiles.map((tp) => tp.userId);
      const asOfDate = new Date().toISOString().slice(0, 10);
      const activeLeases = await this.leaseRepository
        .createQueryBuilder('l')
        .innerJoin('l.unit', 'unit')
        .innerJoin('unit.property', 'property')
        .select('l.tenantId', 'tenantId')
        .addSelect('unit.unitNumber', 'unitNumber')
        .addSelect('property.name', 'propertyName')
        .where('l.tenantId IN (:...userIds)', { userIds })
        .andWhere('l.status = :status', { status: LeaseStatus.ACTIVE })
        .andWhere('l.startDate <= :asOfDate', { asOfDate })
        .andWhere('l.endDate >= :asOfDate', { asOfDate })
        .orderBy('l.startDate', 'ASC')
        .getRawMany();

      for (const uid of userIds) {
        const leases = activeLeases.filter((r: any) => r.tenantId === uid);
        const first = leases[0];
        leaseInfoMap.set(uid, {
          count: leases.length,
          firstUnitNumber: first?.unitNumber ?? null,
          firstPropertyName: first?.propertyName ?? null,
        });
      }
    }

    const data: TenantListItemDto[] = validTenantProfiles.map((tenantProfile) => {
      const base = this.toResponseDto(
        tenantProfile,
        tenantProfile.user,
        companyId,
        userCompanyMap.get(tenantProfile.userId),
      );
      const leaseInfo = leaseInfoMap.get(tenantProfile.userId) ?? {
        count: 0,
        firstUnitNumber: null,
        firstPropertyName: null,
      };
      return {
        ...base,
        activeLeaseCount: leaseInfo.count,
        currentUnitNumber: leaseInfo.firstUnitNumber,
        currentPropertyName: leaseInfo.firstPropertyName,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  private async getLeaseInfoForTenantUserId(
    userId: string,
  ): Promise<{
    count: number;
    firstUnitNumber: string | null;
    firstPropertyName: string | null;
  }> {
    const asOfDate = new Date().toISOString().slice(0, 10);
    const rows = await this.leaseRepository
      .createQueryBuilder('l')
      .innerJoin('l.unit', 'unit')
      .innerJoin('unit.property', 'property')
      .select('unit.unitNumber', 'unitNumber')
      .addSelect('property.name', 'propertyName')
      .where('l.tenantId = :userId', { userId })
      .andWhere('l.status = :status', { status: LeaseStatus.ACTIVE })
      .andWhere('l.startDate <= :asOfDate', { asOfDate })
      .andWhere('l.endDate >= :asOfDate', { asOfDate })
      .orderBy('l.startDate', 'ASC')
      .getRawMany();
    const first = rows[0];
    return {
      count: rows.length,
      firstUnitNumber: first?.unitNumber ?? null,
      firstPropertyName: first?.propertyName ?? null,
    };
  }

  async findOne(
    tenantId: string,
    requesterUserId: string,
  ): Promise<TenantDetailsResponseDto> {
    const tenantProfile = await this.tenantProfileRepository.findOne({
      where: { id: tenantId },
      relations: ['user', 'company'],
    });

    if (!tenantProfile) {
      throw new BusinessException(
        ErrorCode.TENANT_NOT_FOUND,
        ERROR_MESSAGES.TENANT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { tenantId },
      );
    }

    // Check if tenant was deleted (soft delete)
    // Check UserCompany relationship first - if inactive, tenant is deleted
    const userCompany = await this.userCompanyRepository.findOne({
      where: {
        userId: tenantProfile.userId,
        companyId: tenantProfile.companyId,
        isActive: true,
      },
    });

    // If UserCompany is inactive or status is FORMER, tenant is deleted/removed
    if (!userCompany || tenantProfile.status === TenantStatus.FORMER) {
      throw new BusinessException(
        ErrorCode.TENANT_NOT_FOUND,
        ERROR_MESSAGES.TENANT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { tenantId },
      );
    }

    // Access control
    const requesterUser = await this.userRepository.findOne({
      where: { id: requesterUserId },
    });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    if (!isSuperAdmin) {
      // Check if requester is the tenant themselves
      if (tenantProfile.userId === requesterUserId) {
        // Tenant viewing own profile - allowed
      } else {
        // Check if requester has permission (COMPANY_ADMIN or MANAGER in same company)
        const requesterUserCompany = await this.userCompanyRepository.findOne({
          where: {
            userId: requesterUserId,
            companyId: tenantProfile.companyId,
            isActive: true,
          },
        });

        if (
          !requesterUserCompany ||
          ![UserRole.COMPANY_ADMIN, UserRole.MANAGER].includes(
            requesterUserCompany.role,
          )
        ) {
          throw new BusinessException(
            ErrorCode.CAN_ONLY_VIEW_OWN_TENANT_DATA,
            ERROR_MESSAGES.CAN_ONLY_VIEW_OWN_TENANT_DATA,
            HttpStatus.FORBIDDEN,
            { tenantId },
          );
        }
      }
    }

    const base = this.toResponseDto(
      tenantProfile,
      tenantProfile.user,
      tenantProfile.companyId,
      userCompany,
    );

    const asOfDate = new Date().toISOString().slice(0, 10);
    const activeLeaseEntities = await this.leaseRepository
      .createQueryBuilder('l')
      .innerJoinAndSelect('l.unit', 'unit')
      .innerJoinAndSelect('unit.property', 'property')
      .where('l.tenantId = :userId', { userId: tenantProfile.userId })
      .andWhere('l.status = :status', { status: LeaseStatus.ACTIVE })
      .andWhere('l.startDate <= :asOfDate', { asOfDate })
      .andWhere('l.endDate >= :asOfDate', { asOfDate })
      .orderBy('l.startDate', 'ASC')
      .getMany();

    const activeLeases: TenantActiveLeaseSummaryDto[] = activeLeaseEntities.map(
      (l) => ({
        id: l.id,
        unitId: l.unitId,
        unitNumber: (l as any).unit?.unitNumber ?? '',
        propertyId: (l as any).unit?.propertyId ?? '',
        propertyName: (l as any).unit?.property?.name ?? '',
        startDate: new Date(l.startDate).toISOString().slice(0, 10),
        endDate: new Date(l.endDate).toISOString().slice(0, 10),
        status: l.status,
        monthlyRent: l.monthlyRent ? Number(l.monthlyRent) : null,
        leaseNumber: l.leaseNumber ?? null,
      }),
    );

    const financialSummary =
      activeLeaseEntities.length > 0
        ? await this.getFinancialSummaryForTenant(
            tenantProfile.userId,
            tenantProfile.companyId,
          )
        : null;

    return {
      ...base,
      activeLeases,
      financialSummary: financialSummary ?? undefined,
    };
  }

  private async getFinancialSummaryForTenant(
    userId: string,
    companyId: string,
  ): Promise<TenantFinancialSummaryDto | null> {
    const settings = await this.companySettingsService.getOrCreate(companyId);
    const currency = settings?.defaultCurrency ?? 'USD';

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);

    const cycles = await this.rentCycleRepository
      .createQueryBuilder('rc')
      .where('rc.tenantId = :userId', { userId })
      .andWhere('rc.companyId = :companyId', { companyId })
      .andWhere('rc.isVoid = :isVoid', { isVoid: false })
      .andWhere('rc.dueDate >= :periodStart', { periodStart })
      .andWhere('rc.dueDate <= :periodEnd', { periodEnd })
      .getMany();

    const totalRentDue = cycles.reduce(
      (sum, c) => sum + Number(c.totalAmountDue ?? 0),
      0,
    );
    const cycleIds = cycles.map((c) => c.id);
    if (cycleIds.length === 0) {
      return {
        currency,
        totalRentDue: 0,
        totalRentCollected: 0,
        outstandingBalance: 0,
        periodStart,
        periodEnd,
      };
    }

    const excludedStatuses = [PaymentStatus.REFUNDED, PaymentStatus.CANCELLED];
    const payments = await this.paymentRepository
      .createQueryBuilder('p')
      .where('p.rentCycleId IN (:...cycleIds)', { cycleIds })
      .andWhere('p.tenantId = :userId', { userId })
      .andWhere('p.isActive = :isActive', { isActive: true })
      .andWhere('p.status NOT IN (:...excluded)', {
        excluded: excludedStatuses,
      })
      .getMany();
    const totalRentCollected = payments.reduce(
      (sum, p) => sum + Number(p.amount ?? 0),
      0,
    );
    const outstandingBalance = Math.max(0, totalRentDue - totalRentCollected);
    return {
      currency,
      totalRentDue,
      totalRentCollected,
      outstandingBalance,
      periodStart,
      periodEnd,
    };
  }

  async update(
    tenantId: string,
    updateDto: UpdateTenantDto,
    requesterUserId: string,
  ): Promise<TenantResponseDto> {
    const tenantProfile = await this.tenantProfileRepository.findOne({
      where: { id: tenantId },
      relations: ['user', 'company'],
    });

    if (!tenantProfile) {
      throw new BusinessException(
        ErrorCode.TENANT_NOT_FOUND,
        ERROR_MESSAGES.TENANT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { tenantId },
      );
    }

    // Access control (same as findOne)
    const requesterUser = await this.userRepository.findOne({
      where: { id: requesterUserId },
    });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    let requesterUserCompany: UserCompany | null = null;
    if (!isSuperAdmin) {
      if (tenantProfile.userId === requesterUserId) {
        // Tenant updating own profile - allowed, but status updates are restricted
        if (updateDto.status !== undefined) {
          throw new BusinessException(
            ErrorCode.CAN_ONLY_VIEW_OWN_TENANT_DATA,
            'Tenants cannot update their own status. Status is managed automatically based on active leases.',
            HttpStatus.FORBIDDEN,
            { tenantId },
          );
        }
      } else {
        requesterUserCompany = await this.userCompanyRepository.findOne({
          where: {
            userId: requesterUserId,
            companyId: tenantProfile.companyId,
            isActive: true,
          },
        });

        if (
          !requesterUserCompany ||
          ![UserRole.COMPANY_ADMIN, UserRole.MANAGER].includes(
            requesterUserCompany.role,
          )
        ) {
          throw new BusinessException(
            ErrorCode.CAN_ONLY_VIEW_OWN_TENANT_DATA,
            ERROR_MESSAGES.CAN_ONLY_VIEW_OWN_TENANT_DATA,
            HttpStatus.FORBIDDEN,
            { tenantId },
          );
        }
      }
    }

    // Update User if name changed
    if (
      updateDto.name !== undefined &&
      updateDto.name !== tenantProfile.user.name
    ) {
      await this.userRepository.update(tenantProfile.userId, {
        name: updateDto.name,
      });
    }

    // Update TenantProfile
    const updateData: any = {};

    if (updateDto.phone !== undefined)
      updateData.phone = updateDto.phone || null;
    if (updateDto.alternativePhone !== undefined)
      updateData.alternativePhone = updateDto.alternativePhone || null;
    if (updateDto.dateOfBirth !== undefined)
      updateData.dateOfBirth = updateDto.dateOfBirth
        ? new Date(updateDto.dateOfBirth)
        : null;
    if (updateDto.idNumber !== undefined)
      updateData.idNumber = updateDto.idNumber || null;
    if (updateDto.idType !== undefined)
      updateData.idType = updateDto.idType || null;
    if (updateDto.address !== undefined)
      updateData.address = updateDto.address || null;
    if (updateDto.city !== undefined) updateData.city = updateDto.city || null;
    if (updateDto.state !== undefined)
      updateData.state = updateDto.state || null;
    if (updateDto.zipCode !== undefined)
      updateData.zipCode = updateDto.zipCode || null;
    if (updateDto.country !== undefined)
      updateData.country = updateDto.country || null;
    if (updateDto.emergencyContactName !== undefined)
      updateData.emergencyContactName = updateDto.emergencyContactName || null;
    if (updateDto.emergencyContactPhone !== undefined)
      updateData.emergencyContactPhone =
        updateDto.emergencyContactPhone || null;
    if (updateDto.emergencyContactRelationship !== undefined)
      updateData.emergencyContactRelationship =
        updateDto.emergencyContactRelationship || null;
    if (updateDto.notes !== undefined)
      updateData.notes = updateDto.notes || null;
    if (updateDto.tags !== undefined) updateData.tags = updateDto.tags || null;
    if (updateDto.emailNotifications !== undefined)
      updateData.emailNotifications = updateDto.emailNotifications;
    if (updateDto.smsNotifications !== undefined)
      updateData.smsNotifications = updateDto.smsNotifications;

    // Status can only be updated by admins/managers (checked above)
    if (updateDto.status !== undefined) {
      updateData.status = updateDto.status;
    }

    await this.tenantProfileRepository.update(tenantId, updateData);

    // Fetch updated data
    const updatedTenantProfile = await this.tenantProfileRepository.findOne({
      where: { id: tenantId },
      relations: ['user', 'company'],
    });

    const userCompany = await this.userCompanyRepository.findOne({
      where: {
        userId: tenantProfile.userId,
        companyId: tenantProfile.companyId,
        isActive: true,
      },
    });

    return this.toResponseDto(
      updatedTenantProfile!,
      updatedTenantProfile!.user,
      tenantProfile.companyId,
      userCompany!,
    );
  }

  async delete(tenantId: string, requesterUserId: string): Promise<void> {
    const tenantProfile = await this.tenantProfileRepository.findOne({
      where: { id: tenantId },
    });

    if (!tenantProfile) {
      throw new BusinessException(
        ErrorCode.TENANT_NOT_FOUND,
        ERROR_MESSAGES.TENANT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { tenantId },
      );
    }

    // Permission check (only COMPANY_ADMIN/MANAGER)
    const requesterUser = await this.userRepository.findOne({
      where: { id: requesterUserId },
    });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    if (!isSuperAdmin) {
      const requesterUserCompany = await this.userCompanyRepository.findOne({
        where: {
          userId: requesterUserId,
          companyId: tenantProfile.companyId,
          isActive: true,
        },
      });

      if (
        !requesterUserCompany ||
        ![UserRole.COMPANY_ADMIN, UserRole.MANAGER].includes(
          requesterUserCompany.role,
        )
      ) {
        throw new BusinessException(
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          'Only company administrators and managers can remove tenants.',
          HttpStatus.FORBIDDEN,
          { requiredRoles: [UserRole.COMPANY_ADMIN, UserRole.MANAGER] },
        );
      }
    }

    // Soft delete: Set status to FORMER and remove UserCompany relationship
    await this.tenantProfileRepository.update(tenantId, {
      status: TenantStatus.FORMER,
    });

    // Remove UserCompany relationship
    const userCompany = await this.userCompanyRepository.findOne({
      where: {
        userId: tenantProfile.userId,
        companyId: tenantProfile.companyId,
        isActive: true,
      },
    });

    if (userCompany) {
      await this.userCompanyRepository.update(userCompany.id, {
        isActive: false,
      });
    }
  }

  /**
   * Update tenant status based on active lease count
   * 
   * TENANT TRUTH SOURCE RULE:
   * - Invoice status is the SINGLE SOURCE OF TRUTH for tenant payment status
   * - Tenant/lease status is DERIVED from invoice statuses (not stored)
   * - No caching of payment status on tenant/lease entities
   * - To determine if tenant is due/overdue, query invoice statuses
   * - This method only updates tenant ACTIVE/FORMER status based on lease existence
   * - Payment status (due/overdue) must be derived from invoice statuses, not tenant status
   */
  async updateTenantStatusBasedOnActiveLeaseCount(
    tenantId: string,
    companyId: string,
    activeLeaseCount: number,
  ): Promise<void> {
    // This method is called from LeaseService to update tenant status based on active lease count
    // Note: This only updates ACTIVE/FORMER status, NOT payment status
    // Payment status (due/overdue) is derived from invoice statuses
    const tenantProfile = await this.tenantProfileRepository.findOne({
      where: { userId: tenantId, companyId },
    });

    if (!tenantProfile) {
      return;
    }

    if (activeLeaseCount > 0) {
      // Has active leases: Set tenant status to ACTIVE
      if (tenantProfile.status !== TenantStatus.ACTIVE) {
        await this.tenantProfileRepository.update(tenantProfile.id, {
          status: TenantStatus.ACTIVE,
        });
      }
    } else {
      // No active leases: Set tenant status to FORMER (if was ACTIVE)
      if (tenantProfile.status === TenantStatus.ACTIVE) {
        await this.tenantProfileRepository.update(tenantProfile.id, {
          status: TenantStatus.FORMER,
        });
      }
    }
  }

  private toResponseDto(
    tenantProfile: TenantProfile,
    user: User,
    companyId: string,
    userCompany?: UserCompany,
  ): TenantResponseDto {
    return {
      id: tenantProfile.id,
      userId: tenantProfile.userId,
      companyId,
      email: user.email,
      name: user.name,
      phone: tenantProfile.phone,
      alternativePhone: tenantProfile.alternativePhone,
      dateOfBirth: tenantProfile.dateOfBirth,
      idNumber: tenantProfile.idNumber,
      idType: tenantProfile.idType,
      address: tenantProfile.address,
      city: tenantProfile.city,
      state: tenantProfile.state,
      zipCode: tenantProfile.zipCode,
      country: tenantProfile.country,
      emergencyContactName: tenantProfile.emergencyContactName,
      emergencyContactPhone: tenantProfile.emergencyContactPhone,
      emergencyContactRelationship: tenantProfile.emergencyContactRelationship,
      status: tenantProfile.status,
      notes: tenantProfile.notes,
      tags: tenantProfile.tags,
      emailNotifications: tenantProfile.emailNotifications,
      smsNotifications: tenantProfile.smsNotifications,
      role: UserRole.TENANT,
      joinedAt: userCompany?.joinedAt || tenantProfile.createdAt,
      isActive: user.isActive,
      createdAt: tenantProfile.createdAt,
      updatedAt: tenantProfile.updatedAt,
    };
  }
}
