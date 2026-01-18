import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { UserRole } from '../../shared/enums/user-role.enum';
import { ExpenseService } from './expense.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ListExpensesQueryDto } from './dto/list-expenses-query.dto';
import { ExpenseResponseDto } from './dto/expense-response.dto';
import { ExpenseSummaryResponseDto } from './dto/expense-summary-response.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@ApiTags('expenses')
@Controller({ path: 'expenses', version: '1' })
@UseGuards(RolesGuard)
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth('access_token')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER, UserRole.LANDLORD)
  @ApiOperation({ summary: 'Create a new expense (MVP tracking only)' })
  @ApiResponse({
    status: 201,
    description: 'Expense created successfully',
    type: ExpenseResponseDto,
  })
  async create(
    @Body() createExpenseDto: CreateExpenseDto,
    @AuthUser() user: { id: string },
  ) {
    const expense = await this.expenseService.create(
      createExpenseDto,
      user.id,
    );
    return {
      success: true,
      data: expense,
      message: 'Expense created successfully',
    };
  }

  @Get()
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'List expenses with filtering and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Expenses retrieved successfully',
  })
  async findAll(
    @Query() query: ListExpensesQueryDto,
    @AuthUser() user: { id: string },
  ) {
    const result = await this.expenseService.findAll(query, user.id);
    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get('summary')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get expense summary (total and by category)' })
  @ApiResponse({
    status: 200,
    description: 'Expense summary retrieved successfully',
    type: ExpenseSummaryResponseDto,
  })
  async getSummary(
    @Query() query: ListExpensesQueryDto,
    @AuthUser() user: { id: string },
  ) {
    const summary = await this.expenseService.getSummary(query, user.id);
    return {
      success: true,
      data: summary,
    };
  }

  @Patch(':id')
  @ApiCookieAuth('access_token')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER, UserRole.LANDLORD)
  @ApiOperation({ summary: 'Update an expense (MVP tracking only)' })
  @ApiResponse({
    status: 200,
    description: 'Expense updated successfully',
    type: ExpenseResponseDto,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateExpenseDto,
    @AuthUser() user: { id: string },
  ) {
    const expense = await this.expenseService.update(id, updateDto, user.id);
    return {
      success: true,
      data: expense,
      message: 'Expense updated successfully',
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('access_token')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER, UserRole.LANDLORD)
  @ApiOperation({ summary: 'Delete an expense (MVP tracking only)' })
  @ApiResponse({
    status: 200,
    description: 'Expense deleted successfully',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @AuthUser() user: { id: string },
  ) {
    await this.expenseService.remove(id, user.id);
    return {
      success: true,
      message: 'Expense deleted successfully',
    };
  }
}
