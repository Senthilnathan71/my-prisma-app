import { Logger, Module } from '@nestjs/common';
import { ShortcutController } from './shortcut.controller';
import { ShortcutService } from './shortcut.service';

@Module({
  controllers: [ShortcutController],
  providers:[ShortcutService,Logger]
})
export class ShortcutModule {}
