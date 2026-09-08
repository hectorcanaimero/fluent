import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/**
 * `timezone` (SPEC-02 §8): zona horaria IANA válida.
 *
 * Sin dependencias nuevas, como pide el alcance de PR-02/T2: se construye un
 * `Intl.DateTimeFormat` con esa zona dentro de un `try/catch` — si el motor
 * (ICU, incluido en Node) no la reconoce, lanza `RangeError` y el validador
 * falla. Equivalente a comprobar pertenencia en `Intl.supportedValuesOf`,
 * pero también acepta alias válidos que esa lista no siempre incluye.
 */
export function isValidIanaTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }
  try {
    // eslint-disable-next-line no-new -- solo interesa si lanza o no.
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function IsIanaTimezone(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'isIanaTimezone',
      target: object.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return isValidIanaTimezone(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} debe ser una zona horaria IANA válida (por ejemplo 'America/Sao_Paulo')`;
        },
      },
    });
  };
}
