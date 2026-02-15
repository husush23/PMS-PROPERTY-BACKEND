import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
    imports: [NotificationModule],
    controllers: [ContactController],
})
export class ContactModule { }
