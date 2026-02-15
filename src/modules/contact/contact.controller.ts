import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { NotificationService } from '../notification/notification.service';
import { ContactDto } from './dto/contact.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('contact')
export class ContactController {
    constructor(private readonly notificationService: NotificationService) { }

    @Post()
    @Public()
    @UseGuards(ThrottlerGuard)
    async sendMessage(@Body() contactDto: ContactDto) {
        await this.notificationService.sendContactEmail(
            contactDto.name,
            contactDto.email,
            contactDto.message,
        );
        return { success: true, message: 'Message sent successfully' };
    }
}
