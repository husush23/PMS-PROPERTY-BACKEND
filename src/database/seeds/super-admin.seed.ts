import { DataSource } from 'typeorm';
import { User } from '../../modules/user/entities/user.entity';
import { PasswordUtil } from '../../common/utils/password.util';

export async function seedSuperAdmin(dataSource: DataSource): Promise<void> {
  const userRepository = dataSource.getRepository(User);

  // Check if any super admin already exists
  const existingSuperAdmin = await userRepository.findOne({
    where: { isSuperAdmin: true },
  });

  if (existingSuperAdmin) {
    console.log('Super admin already exists. Skipping seed.');
    return;
  }

  // Get super admin credentials from environment variables
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
  const superAdminName = process.env.SUPER_ADMIN_NAME || 'Super Admin';

  if (!superAdminEmail || !superAdminPassword) {
    console.warn(
      '⚠️  WARNING: SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are not set in environment variables.',
    );
    console.warn('Skipping super admin seed. Please set these variables to create a super admin.');
    return;
  }

  // Check if user with this email already exists
  const existingUser = await userRepository.findOne({
    where: { email: superAdminEmail },
  });

  if (existingUser) {
    // Update existing user to be super admin
    await userRepository.update(existingUser.id, {
      isSuperAdmin: true,
    });
    console.log(`✅ Updated existing user "${superAdminEmail}" to super admin.`);
    return;
  }

  // Create new super admin user
  const hashedPassword = await PasswordUtil.hash(superAdminPassword);

  const superAdmin = userRepository.create({
    email: superAdminEmail,
    password: hashedPassword,
    name: superAdminName,
    isActive: true,
    isSuperAdmin: true,
  });

  await userRepository.save(superAdmin);
  console.log(`✅ Super admin created successfully: ${superAdminEmail}`);
}

