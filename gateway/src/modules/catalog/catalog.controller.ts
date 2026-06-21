import {
  Controller,
  Get,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';

/** gRPC-интерфейс CatalogService (имена методов — camelCase от rpc в catalog.proto). */
interface CatalogGrpc {
  getMenu(data: Record<string, never>): Observable<{ categories: unknown[] }>;
}

/** REST-эндпоинты каталога. Проксируют в catalog-service по gRPC. */
@Controller('catalog')
export class CatalogController implements OnModuleInit {
  private svc!: CatalogGrpc;

  constructor(@Inject('CATALOG_PACKAGE') private readonly client: ClientGrpc) {}

  onModuleInit(): void {
    this.svc = this.client.getService<CatalogGrpc>('CatalogService');
  }

  // Публичное меню: защита не требуется.
  // Распаковка: gRPC отдаёт { categories }, фронт ждёт массив категорий.
  @Get('menu')
  async menu(): Promise<unknown> {
    const res = await firstValueFrom(this.svc.getMenu({}));
    return res.categories;
  }
}
