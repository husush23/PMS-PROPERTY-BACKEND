import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ContactDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(10)
    message: string;
}
