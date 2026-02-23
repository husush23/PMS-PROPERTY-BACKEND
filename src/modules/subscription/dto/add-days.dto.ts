import { IsNumber, IsNotEmpty } from 'class-validator';

export class AddDaysDto {
    @IsNumber()
    @IsNotEmpty()
    days: number;
}
