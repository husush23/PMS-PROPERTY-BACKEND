import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
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
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Company } from './entities/company.entity';
import { CompanySettingsService } from './company-settings.service';
import { PaymentMethodsService } from '../payment-method/payment-methods.service';
import { UserCompany } from './entities/user-company.entity';
import {
  CompanyInvitation,
  InvitationStatus,
} from './entities/company-invitation.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyResponseDto } from './dto/company-response.dto';
import { AddUserToCompanyDto } from './dto/add-user-to-company.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { MemberResponseDto } from './dto/member-response.dto';
import { UserRole } from '../../shared/enums/user-role.enum';
import { User } from '../user/entities/user.entity';
import { NotificationService } from '../notification/notification.service';
import { AcceptCompanyInvitationPublicDto } from './dto/accept-company-invitation-public.dto';
import { PasswordUtil } from '../../common/utils/password.util';
import { SubscriptionService } from '../subscription/subscription.service';

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
    private companySettingsService: CompanySettingsService,
    private paymentMethodsService: PaymentMethodsService,
    @InjectRepository(UserCompany)
    private userCompanyRepository: Repository<UserCompany>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(CompanyInvitation)
    private invitationRepository: Repository<CompanyInvitation>,
    @InjectDataSource()
    private dataSource: DataSource,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
    @Inject(forwardRef(() => SubscriptionService))
    private subscriptionService: SubscriptionService,
  ) { }

  async create(
    createCompanyDto: CreateCompanyDto,
    userId: string,
  ): Promise<CompanyResponseDto> {
    // Check if slug already exists
    if (createCompanyDto.slug) {
      const existing = await this.companyRepository.findOne({
        where: { slug: createCompanyDto.slug },
      });
      if (existing) {
        throw new BusinessException(
          ErrorCode.COMPANY_SLUG_EXISTS,
          ERROR_MESSAGES.COMPANY_SLUG_EXISTS,
          HttpStatus.CONFLICT,
          { field: 'slug', value: createCompanyDto.slug },
        );
      }
    }

    // Generate slug from name if not provided
    let slug = createCompanyDto.slug;
    if (!slug) {
      slug = this.generateSlug(createCompanyDto.name);
      // Ensure uniqueness
      let counter = 1;
      let uniqueSlug = slug;
      while (
        await this.companyRepository.findOne({ where: { slug: uniqueSlug } })
      ) {
        uniqueSlug = `${slug}-${counter}`;
        counter++;
      }
      slug = uniqueSlug;
    }

    const allowedPaymentMethods =
      await this.paymentMethodsService.getActiveGlobalPaymentMethodCodes();

    const { company: savedCompany, settings } =
      await this.dataSource.transaction(async (manager) => {
        const company = this.companyRepository.create({
          ...createCompanyDto,
          slug,
        });
        const companyEntity = await manager.getRepository(Company).save(company);
        const companySettings =
          await this.companySettingsService.createWithDefaults(
            companyEntity.id,
            allowedPaymentMethods,
            createCompanyDto.defaultCurrency,
            manager,
          );
        return { company: companyEntity, settings: companySettings };
      });

    // Assign creator as COMPANY_ADMIN
    await this.assignUserToCompany(
      userId,
      savedCompany.id,
      UserRole.COMPANY_ADMIN,
    );

    // Create Trial Subscription
    try {
      await this.subscriptionService.createTrial(savedCompany.id);
    } catch (error) {
      this.logger.error(`Failed to create trial subscription for company ${savedCompany.id}`, error);
      // Should we revert transaction? Probably yes if subscription is core.
      // But createTrial is separate logic.
      // For now, log error. Super admin can fix it.
    }

    return {
      ...this.toResponseDto(savedCompany),
      settingsId: settings.id,
    };
  }

  async findAll(userId: string): Promise<CompanyResponseDto[]> {
    const userCompanies = await this.userCompanyRepository.find({
      where: { userId, isActive: true },
      relations: ['company', 'company.subscriptions', 'company.subscriptions.plan'],
    });

    return userCompanies.map((uc) => this.toResponseDto(uc.company));
  }

  async findOne(id: string, userId: string): Promise<CompanyResponseDto> {
    // Check if user is super admin
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user?.isSuperAdmin) {
      // Super admin can access any company
      const company = await this.companyRepository.findOne({
        where: { id },
        relations: ['subscriptions', 'subscriptions.plan']
      });
      if (!company) {
        throw new BusinessException(
          ErrorCode.COMPANY_NOT_FOUND,
          ERROR_MESSAGES.COMPANY_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          { companyId: id },
        );
      }
      return this.toResponseDto(company);
    }

    // Verify user belongs to company
    const userCompany = await this.userCompanyRepository.findOne({
      where: { companyId: id, userId, isActive: true },
      relations: ['company', 'company.subscriptions', 'company.subscriptions.plan'],
    });

    if (!userCompany) {
      throw new BusinessException(
        ErrorCode.COMPANY_NOT_FOUND,
        ERROR_MESSAGES.COMPANY_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { companyId: id },
      );
    }

    return this.toResponseDto(userCompany.company);
  }

  async update(
    id: string,
    updateCompanyDto: UpdateCompanyDto,
    userId: string,
  ): Promise<CompanyResponseDto> {
    // Check if user is super admin
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const isSuperAdmin = user?.isSuperAdmin || false;

    if (!isSuperAdmin) {
      // Verify user is COMPANY_ADMIN of this company
      const userCompany = await this.userCompanyRepository.findOne({
        where: {
          companyId: id,
          userId,
          role: UserRole.COMPANY_ADMIN,
          isActive: true,
        },
      });

      if (!userCompany) {
        throw new BusinessException(
          ErrorCode.NOT_COMPANY_ADMIN,
          ERROR_MESSAGES.NOT_COMPANY_ADMIN,
          HttpStatus.FORBIDDEN,
          { companyId: id },
        );
      }
    }

    if (updateCompanyDto.slug) {
      const existing = await this.companyRepository.findOne({
        where: { slug: updateCompanyDto.slug },
      });
      if (existing && existing.id !== id) {
        throw new BusinessException(
          ErrorCode.COMPANY_SLUG_EXISTS,
          ERROR_MESSAGES.COMPANY_SLUG_EXISTS,
          HttpStatus.CONFLICT,
          { field: 'slug', value: updateCompanyDto.slug },
        );
      }
    }

    await this.companyRepository.update(id, updateCompanyDto);
    const updated = await this.companyRepository.findOne({
      where: { id },
      relations: ['subscriptions', 'subscriptions.plan']
    });
    return this.toResponseDto(updated!);
  }

  async assignUserToCompany(
    userId: string,
    companyId: string,
    role: UserRole,
  ): Promise<UserCompany> {
    // Check if already assigned
    const existing = await this.userCompanyRepository.findOne({
      where: { userId, companyId },
    });

    if (existing) {
      throw new BusinessException(
        ErrorCode.USER_ALREADY_IN_COMPANY,
        ERROR_MESSAGES.USER_ALREADY_IN_COMPANY,
        HttpStatus.CONFLICT,
        { userId, companyId },
      );
    }

    const userCompany = this.userCompanyRepository.create({
      userId,
      companyId,
      role,
    });

    return this.userCompanyRepository.save(userCompany);
  }

  async addUserToCompany(
    companyId: string,
    addUserDto: AddUserToCompanyDto,
    requesterUserId: string,
  ): Promise<void> {
    // Check if requester is super admin
    const requesterUser = await this.userRepository.findOne({
      where: { id: requesterUserId },
    });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    if (!isSuperAdmin) {
      // Verify requester has permission (COMPANY_ADMIN or MANAGER)
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
          'Only company administrators and managers can add users to the company.',
          HttpStatus.FORBIDDEN,
          { requiredRoles: [UserRole.COMPANY_ADMIN, UserRole.MANAGER] },
        );
      }
    }

    await this.assignUserToCompany(
      addUserDto.userId,
      companyId,
      addUserDto.role,
    );
  }

  async getCompanyInvitations(
    companyId: string,
    userId: string,
  ): Promise<CompanyInvitation[]> {
    const member = await this.userCompanyRepository.findOne({
      where: { userId, companyId },
    });

    if (!member) {
      throw new BusinessException(
        ErrorCode.COMPANY_NOT_FOUND,
        'You are not a member of this company',
        HttpStatus.FORBIDDEN,
      );
    }

    if (
      member.role !== UserRole.COMPANY_ADMIN &&
      member.role !== UserRole.MANAGER
    ) {
      throw new BusinessException(
        ErrorCode.INSUFFICIENT_PERMISSIONS,
        'Insufficient permissions to view invitations',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.invitationRepository.find({
      where: { companyId },
      relations: ['inviter'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateUserRole(
    companyId: string,
    userId: string,
    updateRoleDto: UpdateUserRoleDto,
    requesterUserId: string,
  ): Promise<void> {
    // Check if requester is super admin
    const requesterUser = await this.userRepository.findOne({
      where: { id: requesterUserId },
    });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    if (!isSuperAdmin) {
      // Verify requester has permission (COMPANY_ADMIN only)
      const requester = await this.userCompanyRepository.findOne({
        where: {
          companyId,
          userId: requesterUserId,
          role: UserRole.COMPANY_ADMIN,
          isActive: true,
        },
      });

      if (!requester) {
        throw new BusinessException(
          ErrorCode.NOT_COMPANY_ADMIN,
          ERROR_MESSAGES.NOT_COMPANY_ADMIN,
          HttpStatus.FORBIDDEN,
          { companyId },
        );
      }
    }

    const userCompany = await this.userCompanyRepository.findOne({
      where: { companyId, userId },
    });

    if (!userCompany) {
      throw new NotFoundException('User is not assigned to this company');
    }

    await this.userCompanyRepository.update(userCompany.id, {
      role: updateRoleDto.role,
    });
  }

  async removeUserFromCompany(
    companyId: string,
    userId: string,
    requesterUserId: string,
  ): Promise<void> {
    // Check if requester is super admin
    const requesterUser = await this.userRepository.findOne({
      where: { id: requesterUserId },
    });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    if (!isSuperAdmin) {
      // Verify requester has permission (COMPANY_ADMIN only)
      const requester = await this.userCompanyRepository.findOne({
        where: {
          companyId,
          userId: requesterUserId,
          role: UserRole.COMPANY_ADMIN,
          isActive: true,
        },
      });

      if (!requester) {
        throw new BusinessException(
          ErrorCode.NOT_COMPANY_ADMIN,
          ERROR_MESSAGES.NOT_COMPANY_ADMIN,
          HttpStatus.FORBIDDEN,
          { companyId },
        );
      }
    }

    const userCompany = await this.userCompanyRepository.findOne({
      where: { companyId, userId },
    });

    if (!userCompany) {
      throw new BusinessException(
        ErrorCode.USER_NOT_IN_COMPANY,
        ERROR_MESSAGES.USER_NOT_IN_COMPANY,
        HttpStatus.NOT_FOUND,
        { userId, companyId },
      );
    }

    await this.userCompanyRepository.delete(userCompany.id);
  }

  async getUserRoleInCompany(
    userId: string,
    companyId: string,
  ): Promise<UserRole | null> {
    const userCompany = await this.userCompanyRepository.findOne({
      where: { userId, companyId, isActive: true },
    });

    return userCompany ? userCompany.role : null;
  }

  async getUserCompanies(userId: string): Promise<CompanyResponseDto[]> {
    return this.findAll(userId);
  }

  async inviteUserToCompany(
    companyId: string,
    inviteDto: InviteUserDto,
    requesterUserId: string,
  ): Promise<void> {
    // Check if requester is super admin
    const requesterUser = await this.userRepository.findOne({
      where: { id: requesterUserId },
    });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    if (!isSuperAdmin) {
      // Verify requester has permission (COMPANY_ADMIN or MANAGER)
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
          'Only company administrators and managers can invite users to the company.',
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

    // Check if user is already a member
    const existingUser = await this.userRepository.findOne({
      where: { email: inviteDto.email },
    });
    if (existingUser) {
      const existingMember = await this.userCompanyRepository.findOne({
        where: { userId: existingUser.id, companyId },
      });
      if (existingMember) {
        throw new BusinessException(
          ErrorCode.USER_ALREADY_IN_COMPANY,
          ERROR_MESSAGES.USER_ALREADY_IN_COMPANY,
          HttpStatus.CONFLICT,
          { email: inviteDto.email, companyId },
        );
      }
    }

    // Check if there's already a pending invitation for this email
    const existingInvitation = await this.invitationRepository.findOne({
      where: {
        email: inviteDto.email,
        companyId,
        status: InvitationStatus.PENDING,
      },
    });

    let token: string;
    let invitation: CompanyInvitation;

    if (existingInvitation) {
      // Update existing invitation with new token and expiration (resend scenario)
      token = randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await this.invitationRepository.update(existingInvitation.id, {
        token,
        expiresAt,
        role: inviteDto.role, // Update role if changed
        invitedBy: requesterUserId,
      });

      invitation = (await this.invitationRepository.findOne({
        where: { id: existingInvitation.id },
      }))!;
    } else {
      // Generate invitation token
      token = randomUUID();

      // Set expiration to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Create invitation
      invitation = this.invitationRepository.create({
        email: inviteDto.email,
        companyId,
        role: inviteDto.role,
        token,
        status: InvitationStatus.PENDING,
        expiresAt,
        invitedBy: requesterUserId,
      });

      await this.invitationRepository.save(invitation);
    }

    // Send invitation email (don't await - let it run in background)
    const inviterName =
      requesterUser?.name || requesterUser?.email || 'Someone';
    this.notificationService
      .sendInvitationEmail(inviteDto.email, company.name, token, inviterName)
      .catch((error) => {
        this.logger.error('Failed to send invitation email', error);
        // Don't throw - invitation is created, email failure shouldn't block the operation
      });
  }

  async acceptInvitation(
    companyId: string,
    token: string,
    userId: string,
  ): Promise<void> {
    // Find invitation by token
    const invitation = await this.invitationRepository.findOne({
      where: { token },
      relations: ['company'],
    });

    if (!invitation) {
      throw new BusinessException(
        ErrorCode.INVITATION_NOT_FOUND,
        ERROR_MESSAGES.INVITATION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { token },
      );
    }

    // Verify companyId matches
    if (invitation.companyId !== companyId) {
      throw new BusinessException(
        ErrorCode.INVALID_INVITATION_TOKEN,
        ERROR_MESSAGES.INVALID_INVITATION_TOKEN,
        HttpStatus.BAD_REQUEST,
        { token, companyId },
      );
    }

    // Check invitation status
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new BusinessException(
        ErrorCode.INVITATION_ALREADY_ACCEPTED,
        ERROR_MESSAGES.INVITATION_ALREADY_ACCEPTED,
        HttpStatus.BAD_REQUEST,
        { token },
      );
    }

    if (invitation.status === InvitationStatus.CANCELLED) {
      throw new BusinessException(
        ErrorCode.INVITATION_ALREADY_CANCELLED,
        ERROR_MESSAGES.INVITATION_ALREADY_CANCELLED,
        HttpStatus.BAD_REQUEST,
        { token },
      );
    }

    if (invitation.status === InvitationStatus.EXPIRED) {
      throw new BusinessException(
        ErrorCode.INVITATION_EXPIRED,
        ERROR_MESSAGES.INVITATION_EXPIRED,
        HttpStatus.BAD_REQUEST,
        { token },
      );
    }

    // Check if invitation has expired
    if (new Date() > invitation.expiresAt) {
      // Mark as expired
      await this.invitationRepository.update(invitation.id, {
        status: InvitationStatus.EXPIRED,
      });
      throw new BusinessException(
        ErrorCode.INVITATION_EXPIRED,
        ERROR_MESSAGES.INVITATION_EXPIRED,
        HttpStatus.BAD_REQUEST,
        { token },
      );
    }

    // Get user and verify email matches
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOUND,
        ERROR_MESSAGES.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { userId },
      );
    }

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new BusinessException(
        ErrorCode.INVALID_INVITATION_TOKEN,
        'The invitation was sent to a different email address.',
        HttpStatus.FORBIDDEN,
        { token, userEmail: user.email, invitationEmail: invitation.email },
      );
    }

    // Check if user is already a member
    const existingMember = await this.userCompanyRepository.findOne({
      where: { userId, companyId: invitation.companyId },
    });

    if (existingMember) {
      // User is already a member, mark invitation as accepted anyway
      await this.invitationRepository.update(invitation.id, {
        status: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
      });
      return;
    }

    // Add user to company
    await this.assignUserToCompany(
      userId,
      invitation.companyId,
      invitation.role,
    );

    // Mark invitation as accepted
    await this.invitationRepository.update(invitation.id, {
      status: InvitationStatus.ACCEPTED,
      acceptedAt: new Date(),
    });
  }

  async acceptInvitationPublic(
    acceptDto: AcceptCompanyInvitationPublicDto,
  ): Promise<void> {
    // Find invitation by token
    const invitation = await this.invitationRepository.findOne({
      where: { token: acceptDto.token },
      relations: ['company'],
    });

    if (!invitation) {
      throw new BusinessException(
        ErrorCode.INVITATION_NOT_FOUND,
        ERROR_MESSAGES.INVITATION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { token: acceptDto.token },
      );
    }

    // Check invitation status
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new BusinessException(
        ErrorCode.INVITATION_ALREADY_ACCEPTED,
        ERROR_MESSAGES.INVITATION_ALREADY_ACCEPTED,
        HttpStatus.BAD_REQUEST,
        { token: acceptDto.token },
      );
    }

    if (
      invitation.status === InvitationStatus.CANCELLED ||
      invitation.status === InvitationStatus.EXPIRED
    ) {
      throw new BusinessException(
        ErrorCode.INVITATION_EXPIRED,
        ERROR_MESSAGES.INVITATION_EXPIRED,
        HttpStatus.BAD_REQUEST,
        { token: acceptDto.token },
      );
    }

    // Check if expired
    if (new Date() > invitation.expiresAt) {
      await this.invitationRepository.update(invitation.id, {
        status: InvitationStatus.EXPIRED,
      });
      throw new BusinessException(
        ErrorCode.INVITATION_EXPIRED,
        ERROR_MESSAGES.INVITATION_EXPIRED,
        HttpStatus.BAD_REQUEST,
        { token: acceptDto.token },
      );
    }

    // Find or create user
    let user = await this.userRepository.findOne({
      where: { email: invitation.email.toLowerCase() },
    });

    if (!user) {
      // User doesn't exist yet, create it
      const hashedPassword = await PasswordUtil.hash(acceptDto.password);
      user = this.userRepository.create({
        email: invitation.email.toLowerCase(),
        password: hashedPassword,
        name: acceptDto.name,
        isActive: true,
        emailVerified: true, // Specific valid invitation -> trusted email
      });
      user = await this.userRepository.save(user);
    } else {
      // User exists, update password and activate
      const hashedPassword = await PasswordUtil.hash(acceptDto.password);
      await this.userRepository.update(user.id, {
        password: hashedPassword,
        isActive: true,
        emailVerified: true,
        // Also update name if provided? Yes.
        name: acceptDto.name || user.name,
      });
    }

    // Check if user is already in company
    const existingMember = await this.userCompanyRepository.findOne({
      where: { userId: user.id, companyId: invitation.companyId },
    });

    if (existingMember) {
      // Already member, update role? Or keep existing?
      // Usually, invitation defines role. But if they're already member, maybe ignore?
      // Let's assume invitation updates role or adds them.
      // If invitation role is different, update.
      if (existingMember.role !== invitation.role) {
        await this.userCompanyRepository.update(existingMember.id, { role: invitation.role });
      }
    } else {
      // Add user to company
      await this.assignUserToCompany(
        user.id,
        invitation.companyId,
        invitation.role,
      );
    }

    // Mark invitation as accepted
    await this.invitationRepository.update(invitation.id, {
      status: InvitationStatus.ACCEPTED,
      acceptedAt: new Date(),
    });
  }

  async getCompanyMembers(
    companyId: string,
    requesterUserId: string,
  ): Promise<MemberResponseDto[]> {
    // Check if requester is super admin
    const requesterUser = await this.userRepository.findOne({
      where: { id: requesterUserId },
    });
    const isSuperAdmin = requesterUser?.isSuperAdmin || false;

    if (!isSuperAdmin) {
      // Verify requester is a member of the company
      const requester = await this.userCompanyRepository.findOne({
        where: {
          companyId,
          userId: requesterUserId,
          isActive: true,
        },
      });

      if (!requester) {
        throw new BusinessException(
          ErrorCode.NOT_COMPANY_MEMBER,
          ERROR_MESSAGES.NOT_COMPANY_MEMBER,
          HttpStatus.FORBIDDEN,
          { companyId },
        );
      }
    }

    // Get all active members
    const userCompanies = await this.userCompanyRepository.find({
      where: { companyId, isActive: true },
      relations: ['user'],
      order: { joinedAt: 'DESC' },
    });

    return userCompanies.map((uc) => ({
      id: uc.user.id,
      email: uc.user.email,
      name: uc.user.name,
      role: uc.role,
      joinedAt: uc.joinedAt,
      isActive: uc.isActive,
    }));
  }

  async createDefaultCompany(
    name: string = 'Default Company',
  ): Promise<Company> {
    const company = this.companyRepository.create({
      name,
      slug: this.generateSlug(name),
      isActive: true,
    });

    const savedCompany = await this.companyRepository.save(company);
    await this.companySettingsService.getOrCreate(savedCompany.id);
    return savedCompany;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private toResponseDto(company: Company): CompanyResponseDto {
    const latestSub = company.subscriptions?.length > 0
      ? company.subscriptions.sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0]
      : null;

    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      address: company.address,
      phone: company.phone,
      email: company.email,
      logo: company.logo,
      isActive: company.isActive,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      subscriptionStatus: latestSub?.status,
      subscriptionEndsAt: latestSub?.endDate,
      trialEndsAt: latestSub?.trialEndsAt,
      plan: latestSub?.plan?.name
    };
  }
}
