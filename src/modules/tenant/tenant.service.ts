import {
  Injectable,
  HttpStatus,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { BusinessException, ErrorCode } from '../../common/exceptions/business.exception';
import { ERROR_MESSAGES } from '../../common/constants/error-messages.constant';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { TenantProfile } from './entities/tenant-profile.entity';
import { TenantInvitation } from './entities/tenant-invitation.entity';
import { User } from '../user/entities/user.entity';
import { Company } from '../company/entities/company.entity';
import { UserCompany } from '../company/entities/user-company.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantResponseDto } from './dto/tenant-response.dto';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto';
import { UserRole } from '../../shared/enums/user-role.enum';
import { TenantStatus } from '../../shared/enums/tenant-status.enum';
import { InvitationStatus } from '../company/entities/company-invitation.entity';
import { PasswordUtil } from '../../common/utils/password.util';
import { NotificationService } from '../notification/notification.service';
import { UserService } from '../user/user.service';
import { CompanyService } from '../company/company.service';
import { randomUUID } from 'crypto';

@Injectable()
export class TenantService {
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
    private notificationService: NotificationService,
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
    @Inject(forwardRef(() => CompanyService))
    private companyService: CompanyService,
  ) {}

  async inviteTenant(
    companyId: string,
    createDto: CreateTenantDto,
    requesterUserId: string,
  ): Promise<void> {
    // Permission check
    const requesterUser = await this.userRepository.findOne({ where: { id: requesterUserId } });
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
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new BusinessException(
        ErrorCode.COMPANY_NOT_FOUND,
        ERROR_MESSAGES.COMPANY_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { companyId },
      );
    }

    // Check if user exists
    let user = await this.userRepository.findOne({
      where: { email: createDto.email.toLowerCase() },
    });

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
          { email: createDto.email, companyId },
        );
      }
    } else {
      // Create user with inactive status and temporary password
      const tempPassword = randomUUID();
      const hashedPassword = await PasswordUtil.hash(tempPassword);
      
      user = this.userRepository.create({
        email: createDto.email.toLowerCase(),
        password: hashedPassword,
        name: createDto.name || undefined,
        isActive: false,
      });
      user = await this.userRepository.save(user);
    }

    // Create TenantProfile with PENDING status
    const tenantProfile = this.tenantProfileRepository.create({
      userId: user.id,
      companyId,
      phone: createDto.phone,
      alternativePhone: createDto.alternativePhone,
      dateOfBirth: createDto.dateOfBirth ? new Date(createDto.dateOfBirth) : undefined,
      idNumber: createDto.idNumber,
      idType: createDto.idType,
      address: createDto.address,
      city: createDto.city,
      state: createDto.state,
      zipCode: createDto.zipCode,
      country: createDto.country,
      emergencyContactName: createDto.emergencyContactName,
      emergencyContactPhone: createDto.emergencyContactPhone,
      emergencyContactRelationship: createDto.emergencyContactRelationship,
      status: TenantStatus.PENDING,
      notes: createDto.notes,
      tags: createDto.tags,
      emailNotifications: createDto.emailNotifications ?? true,
      smsNotifications: createDto.smsNotifications ?? true,
    });

    const savedTenantProfile = await this.tenantProfileRepository.save(tenantProfile);

    // Create UserCompany relationship with TENANT role
    await this.companyService.assignUserToCompany(user.id, companyId, UserRole.TENANT);

    // Create TenantInvitation
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = this.tenantInvitationRepository.create({
      email: createDto.email.toLowerCase(),
      companyId,
      tenantProfileId: savedTenantProfile.id,
      token,
      status: InvitationStatus.PENDING,
      expiresAt,
      invitedBy: requesterUserId,
    });

    await this.tenantInvitationRepository.save(invitation);

    // Send invitation email
    const inviterName = requesterUser?.name || requesterUser?.email || 'Someone';
    this.notificationService
      .sendTenantInvitationEmail(createDto.email, company.name, token, inviterName)
      .catch((error) => {
        console.error('Failed to send tenant invitation email:', error);
      });
  }

  async acceptTenantInvitation(
    token: string,
    password: string,
  ): Promise<void> {
    const invitation = await this.tenantInvitationRepository.findOne({
      where: { token },
      relations: ['company', 'tenantProfile'],
    });

    if (!invitation) {
      throw new BusinessException(
        ErrorCode.TENANT_INVITATION_NOT_FOUND,
        ERROR_MESSAGES.TENANT_INVITATION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { token },
      );
    }

    // Check invitation status
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new BusinessException(
        ErrorCode.TENANT_INVITATION_ALREADY_ACCEPTED,
        ERROR_MESSAGES.TENANT_INVITATION_ALREADY_ACCEPTED,
        HttpStatus.BAD_REQUEST,
        { token },
      );
    }

    if (invitation.status === InvitationStatus.CANCELLED || invitation.status === InvitationStatus.EXPIRED) {
      throw new BusinessException(
        ErrorCode.TENANT_INVITATION_EXPIRED,
        ERROR_MESSAGES.TENANT_INVITATION_EXPIRED,
        HttpStatus.BAD_REQUEST,
        { token },
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
        { token },
      );
    }

    // Find or create user for the invitation email
    let user = await this.userRepository.findOne({
      where: { email: invitation.email.toLowerCase() },
    });

    if (!user) {
      // User doesn't exist yet, create it
      const hashedPassword = await PasswordUtil.hash(password);
      user = this.userRepository.create({
        email: invitation.email.toLowerCase(),
        password: hashedPassword,
        name: undefined,
        isActive: true,
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
      // User exists, update password and activate
      const hashedPassword = await PasswordUtil.hash(password);
      await this.userRepository.update(user.id, {
        password: hashedPassword,
        isActive: true,
      });
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
  ): Promise<TenantResponseDto> {
    // Permission check
    const requesterUser = await this.userRepository.findOne({ where: { id: requesterUserId } });
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

    // Verify company exists
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new BusinessException(
        ErrorCode.COMPANY_NOT_FOUND,
        ERROR_MESSAGES.COMPANY_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { companyId },
      );
    }

    // Check if user exists
    let user = await this.userRepository.findOne({
      where: { email: createDto.email.toLowerCase() },
    });

    if (!user) {
      // User doesn't exist - create user in inactive state and send invitation
      const tempPassword = randomUUID();
      const hashedPassword = await PasswordUtil.hash(tempPassword);
      
      user = this.userRepository.create({
        email: createDto.email.toLowerCase(),
        password: hashedPassword,
        name: createDto.name || undefined,
        isActive: false,
      });
      user = await this.userRepository.save(user);
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
    const tenantProfile = this.tenantProfileRepository.create({
      userId: user.id,
      companyId,
      phone: createDto.phone,
      alternativePhone: createDto.alternativePhone,
      dateOfBirth: createDto.dateOfBirth ? new Date(createDto.dateOfBirth) : undefined,
      idNumber: createDto.idNumber,
      idType: createDto.idType,
      address: createDto.address,
      city: createDto.city,
      state: createDto.state,
      zipCode: createDto.zipCode,
      country: createDto.country,
      emergencyContactName: createDto.emergencyContactName,
      emergencyContactPhone: createDto.emergencyContactPhone,
      emergencyContactRelationship: createDto.emergencyContactRelationship,
      status: TenantStatus.PENDING,
      notes: createDto.notes,
      tags: createDto.tags,
      emailNotifications: createDto.emailNotifications ?? true,
      smsNotifications: createDto.smsNotifications ?? true,
    });

    const savedTenantProfile = await this.tenantProfileRepository.save(tenantProfile);

    // Create UserCompany relationship with TENANT role
    await this.companyService.assignUserToCompany(user.id, companyId, UserRole.TENANT);

    // If user was just created (inactive), send invitation email
    if (!user.isActive) {
      const token = randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = this.tenantInvitationRepository.create({
        email: createDto.email.toLowerCase(),
        companyId,
        tenantProfileId: savedTenantProfile.id,
        token,
        status: InvitationStatus.PENDING,
        expiresAt,
        invitedBy: requesterUserId,
      });

      await this.tenantInvitationRepository.save(invitation);

      // Send invitation email
      const requesterUser = await this.userRepository.findOne({ where: { id: requesterUserId } });
      const inviterName = requesterUser?.name || requesterUser?.email || 'Someone';
      this.notificationService
        .sendTenantInvitationEmail(createDto.email, company.name, token, inviterName)
        .catch((error) => {
          console.error('Failed to send tenant invitation email:', error);
        });
    }

    return this.toResponseDto(savedTenantProfile, user, companyId);
  }

  async findAll(
    companyId: string,
    queryDto: ListTenantsQueryDto,
    requesterUserId: string,
  ): Promise<{
    data: TenantResponseDto[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    // Permission check
    const requesterUser = await this.userRepository.findOne({ where: { id: requesterUserId } });
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

      if (!tenantProfile) {
        return {
          data: [],
          pagination: { total: 0, page: 1, limit: queryDto.limit || 10, totalPages: 0 },
        };
      }

      const userCompany = await this.userCompanyRepository.findOne({
        where: { userId: requesterUserId, companyId, isActive: true },
      });

      return {
        data: [this.toResponseDto(tenantProfile, tenantProfile.user, companyId, userCompany!)],
        pagination: { total: 1, page: 1, limit: queryDto.limit || 10, totalPages: 1 },
      };
    }

    if (!isSuperAdmin) {
      // Verify requester is a member of the company (COMPANY_ADMIN or MANAGER)
      if (!requesterUserCompany || ![UserRole.COMPANY_ADMIN, UserRole.MANAGER].includes(requesterUserCompany.role)) {
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

    // Build query
    const queryBuilder = this.tenantProfileRepository
      .createQueryBuilder('tenantProfile')
      .leftJoinAndSelect('tenantProfile.user', 'user')
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
      queryBuilder.andWhere('tenantProfile.status = :status', { status: queryDto.status });
    }

    // Apply sorting
    const sortBy = queryDto.sortBy || 'createdAt';
    const sortOrder = queryDto.sortOrder || 'DESC';
    
    if (sortBy === 'name' || sortBy === 'email') {
      queryBuilder.orderBy(`user.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy(`tenantProfile.${sortBy}`, sortOrder);
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    const tenantProfiles = await queryBuilder.getMany();

    // Get UserCompany relationships for joinedAt and role
    const userIds = tenantProfiles.map((tp) => tp.userId);
    const userCompanies = userIds.length > 0
      ? await this.userCompanyRepository
          .createQueryBuilder('uc')
          .where('uc.userId IN (:...userIds)', { userIds })
          .andWhere('uc.companyId = :companyId', { companyId })
          .andWhere('uc.isActive = :isActive', { isActive: true })
          .getMany()
      : [];

    const userCompanyMap = new Map(userCompanies.map((uc) => [uc.userId, uc]));

    const data = tenantProfiles.map((tenantProfile) =>
      this.toResponseDto(tenantProfile, tenantProfile.user, companyId, userCompanyMap.get(tenantProfile.userId)),
    );

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

  async findOne(tenantId: string, requesterUserId: string): Promise<TenantResponseDto> {
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

    // Access control
    const requesterUser = await this.userRepository.findOne({ where: { id: requesterUserId } });
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
          ![UserRole.COMPANY_ADMIN, UserRole.MANAGER].includes(requesterUserCompany.role)
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

    const userCompany = await this.userCompanyRepository.findOne({
      where: { userId: tenantProfile.userId, companyId: tenantProfile.companyId, isActive: true },
    });

    return this.toResponseDto(tenantProfile, tenantProfile.user, tenantProfile.companyId, userCompany!);
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
    const requesterUser = await this.userRepository.findOne({ where: { id: requesterUserId } });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    if (!isSuperAdmin) {
      if (tenantProfile.userId === requesterUserId) {
        // Tenant updating own profile - allowed
      } else {
        const requesterUserCompany = await this.userCompanyRepository.findOne({
          where: {
            userId: requesterUserId,
            companyId: tenantProfile.companyId,
            isActive: true,
          },
        });

        if (
          !requesterUserCompany ||
          ![UserRole.COMPANY_ADMIN, UserRole.MANAGER].includes(requesterUserCompany.role)
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
    if (updateDto.name !== undefined && updateDto.name !== tenantProfile.user.name) {
      await this.userRepository.update(tenantProfile.userId, { name: updateDto.name });
    }

    // Update TenantProfile
    const updateData: any = {};
    
    if (updateDto.phone !== undefined) updateData.phone = updateDto.phone || null;
    if (updateDto.alternativePhone !== undefined) updateData.alternativePhone = updateDto.alternativePhone || null;
    if (updateDto.dateOfBirth !== undefined) updateData.dateOfBirth = updateDto.dateOfBirth ? new Date(updateDto.dateOfBirth) : null;
    if (updateDto.idNumber !== undefined) updateData.idNumber = updateDto.idNumber || null;
    if (updateDto.idType !== undefined) updateData.idType = updateDto.idType || null;
    if (updateDto.address !== undefined) updateData.address = updateDto.address || null;
    if (updateDto.city !== undefined) updateData.city = updateDto.city || null;
    if (updateDto.state !== undefined) updateData.state = updateDto.state || null;
    if (updateDto.zipCode !== undefined) updateData.zipCode = updateDto.zipCode || null;
    if (updateDto.country !== undefined) updateData.country = updateDto.country || null;
    if (updateDto.emergencyContactName !== undefined) updateData.emergencyContactName = updateDto.emergencyContactName || null;
    if (updateDto.emergencyContactPhone !== undefined) updateData.emergencyContactPhone = updateDto.emergencyContactPhone || null;
    if (updateDto.emergencyContactRelationship !== undefined) updateData.emergencyContactRelationship = updateDto.emergencyContactRelationship || null;
    if (updateDto.notes !== undefined) updateData.notes = updateDto.notes || null;
    if (updateDto.tags !== undefined) updateData.tags = updateDto.tags || null;
    if (updateDto.emailNotifications !== undefined) updateData.emailNotifications = updateDto.emailNotifications;
    if (updateDto.smsNotifications !== undefined) updateData.smsNotifications = updateDto.smsNotifications;

    await this.tenantProfileRepository.update(tenantId, updateData);

    // Fetch updated data
    const updatedTenantProfile = await this.tenantProfileRepository.findOne({
      where: { id: tenantId },
      relations: ['user', 'company'],
    });

    const userCompany = await this.userCompanyRepository.findOne({
      where: { userId: tenantProfile.userId, companyId: tenantProfile.companyId, isActive: true },
    });

    return this.toResponseDto(updatedTenantProfile!, updatedTenantProfile!.user, tenantProfile.companyId, userCompany!);
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
    const requesterUser = await this.userRepository.findOne({ where: { id: requesterUserId } });
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
        ![UserRole.COMPANY_ADMIN, UserRole.MANAGER].includes(requesterUserCompany.role)
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
      await this.userCompanyRepository.update(userCompany.id, { isActive: false });
    }
  }

  async updateTenantStatusBasedOnActiveLeaseCount(
    tenantId: string,
    companyId: string,
    activeLeaseCount: number,
  ): Promise<void> {
    // This method is called from LeaseService to update tenant status based on active lease count
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
