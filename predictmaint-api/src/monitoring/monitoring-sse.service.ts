import { Injectable } from '@nestjs/common';
import { MessageEvent } from '@nestjs/common';
import { interval, merge, Observable, Subject } from 'rxjs';
import { finalize, map } from 'rxjs/operators';

//Sin getStream() no hay conexiones → broadcast() no tiene a quién avisar.
//Sin broadcast() la conexión existe pero solo recibirías heartbeats (nada se actualizaría en vivo).
@Injectable()
export class MonitoringSseService {
  private readonly streams = new Set<Subject<MessageEvent>>();

  //crear canal de comunicacion entre el backend y el frontend
  getStream(): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>(); // Suscriptor de eventos
    this.streams.add(subject); // Añade el suscriptor a la lista de suscriptores

    //para no perder la conexion se envia un heartbeat cada 15 segundos
    const heartbeat$ = interval(15_000).pipe(
      map(
        () =>
          ({
            data: JSON.stringify({ type: 'heartbeat', data: {} }), // Evento de heartbeat cada 15 segundos
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
