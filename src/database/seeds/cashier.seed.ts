import { DataSource } from 'typeorm';
import { User } from '../../modules/user/entities/user.entity';
import { Company } from '../../modules/company/entities/company.entity';
import { UserCompany } from '../../modules/company/entities/user-company.entity';
import { UserRole } from '../../shared/enums/user-role.enum';
import { PasswordUtil } from '../../common/utils/password.util';

export async function seedCashier(dataSource: DataSource): Promise<void> {
    const userRepository = dataSource.getRepository(User);
    const companyRepository = dataSource.getRepository(Company);
    const userCompanyRepository = dataSource.getRepository(UserCompany);

    const cashierEmail = process.env.CASHIER_EMAIL || 'cashier@example.com';
    const cashierPassword = process.env.CASHIER_PASSWORD || 'Cashier123!';
    const companyName = 'Demo Company';

    // 1. Find or Create Company
    let company = await companyRepository.findOne({
        where: { name: companyName },
    });

    if (!company) {
        console.log(`Creating company: ${companyName}`);
        company = companyRepository.create({
            name: companyName,
            email: 'info@democompany.com',
            phone: '1234567890',
            address: '123 Demo St',
        });
        await companyRepository.save(company);
    }

    // 2. Find or Create User
    let user = await userRepository.findOne({
        where: { email: cashierEmail },
    });

    if (!user) {
        console.log(`Creating cashier user: ${cashierEmail}`);
        const hashedPassword = await PasswordUtil.hash(cashierPassword);
        user = userRepository.create({
            email: cashierEmail,
            password: hashedPassword,
            name: 'Cashier User',
            isActive: true,
            emailVerified: true,
        });
        await userRepository.save(user);
    } else {
        // Ensure user is active
        if (!user.isActive) {
            await userRepository.update(user.id, { isActive: true });
        }
    }

    // 3. Assign CASHIER role in Company
    const existingRole = await userCompanyRepository.findOne({
        where: { userId: user.id, companyId: company.id },
    });

    if (existingRole) {
        if (existingRole.role !== UserRole.CASHIER) {
            console.log(`Updating user ${cashierEmail} role to CASHIER in ${companyName}`);
            await userCompanyRepository.update(existingRole.id, { role: UserRole.CASHIER });
        }
    } else {
        console.log(`Assigning CASHIER role to ${cashierEmail} in ${companyName}`);
        const userCompany = userCompanyRepository.create({
            user,
            company,
            role: UserRole.CASHIER,
            isActive: true,
        });
        await userCompanyRepository.save(userCompany);
    }

    console.log(`✅ Cashier seeded successfully: ${cashierEmail}`);
}
