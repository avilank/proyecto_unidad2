'use strict';

/** Reglas por nivel de riesgo — usadas por seeders y seed programático. */
module.exports = [
  { nivel: 'LOW', recibe: 'Nadie', canal: '—' },
  { nivel: 'MEDIUM', recibe: 'Técnico asignado', canal: 'WhatsApp texto' },
  { nivel: 'HIGH', recibe: 'Técnico asignado', canal: 'WhatsApp inmediato' },
  { nivel: 'CRITICAL', recibe: 'Técnico + Supervisor', canal: 'WhatsApp + Email' },
];
