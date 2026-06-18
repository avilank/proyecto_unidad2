import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';
import { RolUsuario } from '../enums';

export type AppSubjects = 'all' | 'Order' | 'Alert' | 'Technician' | 'Machine';
export type AppActions = 'manage' | 'create' | 'read' | 'update' | 'delete';
export type AppAbility = MongoAbility<[AppActions, AppSubjects]>;

export interface AbilityUser {
  id: number;
  rol: RolUsuario;
}

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: AbilityUser): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    switch (user.rol) {
      case RolUsuario.JEFE_PLANTA:
      case RolUsuario.SUPERVISOR:
        can('manage', 'all');
        break;
      case RolUsuario.TECNICO_SENIOR:
        can('read', 'all');
        can('update', 'Order');
        can('update', 'Alert');
        break;
      case RolUsuario.TECNICO:
        can('read', 'Order');
        can('read', 'Alert');
        can('read', 'Machine');
        break;
      default:
        can('read', 'all');
    }

    return build();
  }
}
