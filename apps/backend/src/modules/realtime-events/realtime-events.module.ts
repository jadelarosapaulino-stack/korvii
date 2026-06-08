import { Module } from "@nestjs/common";
import { RealtimeEventPublisherService } from "./realtime-event-publisher.service";

@Module({
  providers: [RealtimeEventPublisherService],
  exports: [RealtimeEventPublisherService],
})
export class RealtimeEventsModule {}
