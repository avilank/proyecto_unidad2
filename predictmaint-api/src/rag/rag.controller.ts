import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RegenerateRagPlanDto, RejectRagPlanDto } from './dto/rag.dto';
import { RagService } from './rag.service';

@ApiTags('rag')
@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Get('plan/:orderId')
  @ApiOperation({ summary: 'Obtener plan RAG' })
  getPlan(@Param('orderId') orderId: string) {
    return this.ragService.getPlan(orderId);
  }

  @Post('plan/:orderId/accept')
  @ApiOperation({ summary: 'Aceptar plan RAG' })
  accept(@Param('orderId') orderId: string) {
    return this.ragService.accept(orderId);
  }

  @Post('plan/:orderId/reject')
  @ApiOperation({ summary: 'Rechazar plan RAG' })
  reject(@Param('orderId') orderId: string, @Body() dto: RejectRagPlanDto) {
    return this.ragService.reject(orderId, dto.motivo);
  }

  @Post('plan/:orderId/regenerate')
  @ApiOperation({ summary: 'Regenerar plan RAG' })
  regenerate(@Param('orderId') orderId: string, @Body() dto: RegenerateRagPlanDto) {
    return this.ragService.regenerate(orderId, dto.escalado);
  }
}
