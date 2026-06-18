import { Module } from '@nestjs/common';
import { RepetitiveFaultsController } from './repetitive-faults.controller';
import { RepetitiveFaultsService } from './repetitive-faults.service';

@Module({
  controllers: [RepetitiveFaultsController],
  providers: [RepetitiveFaultsService],
})
export class RepetitiveFaultsModule {}
