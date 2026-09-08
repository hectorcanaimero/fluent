import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import { INTERESTS } from '../../content/index.js';

const MIN_INTERESTS = 3;
const MAX_INTERESTS = 5;

const INTEREST_IDS = new Set(INTERESTS.map((interest) => interest.id));

/**
 * `interests` (SPEC-02 §4.1, §8): entre 3 y 5 ids del catálogo de
 * `apps/api/src/content/interests.json` (vía `INTERESTS`), sin repetidos.
 *
 * SPEC-02 no dice si se permiten ids repetidos; se decide que no (un
 * duplicado no aporta nada y sería un bug del cliente). Ver
 * docs/specs/pendientes/PR-02.md.
 */
export function isValidInterestsCatalog(value: unknown): value is string[] {
  if (!Array.isArray(value)) {
    return false;
  }
  if (value.length < MIN_INTERESTS || value.length > MAX_INTERESTS) {
    return false;
  }
  if (!value.every((id): id is string => typeof id === 'string')) {
    return false;
  }
  if (new Set(value).size !== value.length) {
    return false;
  }
  return value.every((id) => INTEREST_IDS.has(id));
}

export function IsInterestsCatalog(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'isInterestsCatalog',
      target: object.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return isValidInterestsCatalog(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return (
            `${args.property} debe ser un array de ${MIN_INTERESTS} a ${MAX_INTERESTS} ` +
            'ids únicos del catálogo de intereses'
          );
        },
      },
    });
  };
}
