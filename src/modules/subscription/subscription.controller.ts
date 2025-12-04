import { Controller, Get, Post, Body, UseGuards, Request, Patch } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

@Controller('subscription')
@UseGuards(AuthGuard)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('status')
  checkStatus(@Request() req) {
    return this.subscriptionService.checkSubscriptionStatus(req.user.id);
  }

  @Get('features')
  getFeatures(@Request() req) {
    return this.subscriptionService.getFeatures(req.user.id);
  }

  @Post('upgrade')
  upgrade(@Request() req, @Body() body: { durationMonths?: number }) {
    return this.subscriptionService.upgradeToPremi(
      req.user.id,
      body.durationMonths || 1,
    );
  }

  @Post('downgrade')
  downgrade(@Request() req) {
    return this.subscriptionService.downgradeToFree(req.user.id);
  }
}