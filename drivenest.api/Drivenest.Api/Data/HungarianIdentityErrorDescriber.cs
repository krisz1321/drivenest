using Microsoft.AspNetCore.Identity;

namespace Drivenest.Api.Data
{
    public class HungarianIdentityErrorDescriber : IdentityErrorDescriber
    {
        public override IdentityError DefaultError()
        {
            return new IdentityError { Code = nameof(DefaultError), Description = "Ismeretlen hiba történt." };
        }

        public override IdentityError ConcurrencyFailure()
        {
            return new IdentityError { Code = nameof(ConcurrencyFailure), Description = "Az adat időközben módosult, próbáld újra." };
        }

        public override IdentityError PasswordMismatch()
        {
            return new IdentityError { Code = nameof(PasswordMismatch), Description = "A jelenlegi jelszó hibás." };
        }

        public override IdentityError InvalidUserName(string? userName)
        {
            return new IdentityError { Code = nameof(InvalidUserName), Description = $"A felhasználónév (\"{userName}\") érvénytelen." };
        }

        public override IdentityError InvalidEmail(string? email)
        {
            return new IdentityError { Code = nameof(InvalidEmail), Description = $"Az e-mail-cím (\"{email}\") érvénytelen." };
        }

        public override IdentityError DuplicateUserName(string userName)
        {
            return new IdentityError { Code = nameof(DuplicateUserName), Description = $"A \"{userName}\" felhasználónév már foglalt." };
        }

        public override IdentityError DuplicateEmail(string email)
        {
            return new IdentityError { Code = nameof(DuplicateEmail), Description = $"A \"{email}\" e-mail-cím már foglalt." };
        }

        public override IdentityError PasswordTooShort(int length)
        {
            return new IdentityError { Code = nameof(PasswordTooShort), Description = $"A jelszónak legalább {length} karakter hosszúnak kell lennie." };
        }

        public override IdentityError PasswordRequiresNonAlphanumeric()
        {
            return new IdentityError { Code = nameof(PasswordRequiresNonAlphanumeric), Description = "A jelszónak tartalmaznia kell legalább egy speciális karaktert." };
        }

        public override IdentityError PasswordRequiresDigit()
        {
            return new IdentityError { Code = nameof(PasswordRequiresDigit), Description = "A jelszónak tartalmaznia kell legalább egy számjegyet." };
        }

        public override IdentityError PasswordRequiresLower()
        {
            return new IdentityError { Code = nameof(PasswordRequiresLower), Description = "A jelszónak tartalmaznia kell legalább egy kisbetűt." };
        }

        public override IdentityError PasswordRequiresUpper()
        {
            return new IdentityError { Code = nameof(PasswordRequiresUpper), Description = "A jelszónak tartalmaznia kell legalább egy nagybetűt." };
        }
    }
}
