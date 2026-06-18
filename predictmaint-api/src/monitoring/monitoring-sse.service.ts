import { Injectable } from '@nestjs/common';
import { MessageEvent } from '@nestjs/common';
import { interval, merge, Observable, Subject } from 'rxjs';
import { finalize, map } from 'rxjs/operators';

@Injectable()
export class MonitoringSseService {
  private readonly streams = new Set<Subject<MessageEvent>>();

  getStream(): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();
    this.streams.add(subject);

    const heartbeat$ = interval(15_000).pipe(
      map(
        () =>
          ({
            data: JSON.stringify({ type: 'heartbeat', data: {} }),
          }) as MessageEvent,
      ),
    );

    const events$ = subject.asObservable();

    return merge(events$, heartbeat$).pipe(
      finalize(() => {
        this.streams.delete(subject);
      }),
    );
  }

  broadcast(type: string, data: unknown): void {
    const payload: MessageEvent = {
      data: JSON.stringify({ type, data }),
    };
    this.streams.forEach((stream) => stream.next(payload));
  }
}
