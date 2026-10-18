using Drivenest.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Drivenest.Api.Data.Configurations
{
    public class ServiceCategoryConfiguration : IEntityTypeConfiguration<ServiceCategory>
    {
        public void Configure(EntityTypeBuilder<ServiceCategory> builder)
        {
            builder.ToTable("ServiceCategories");

            builder.Property(x => x.Name)
                .HasMaxLength(100)
                .IsRequired();

            // Ugyanúgy, mint a kiadás-kategóriáknál: a név felhasználónként egyedi,
            // a beépítettek (UserId = NULL) között is. Az EF alap szűrőjét kikapcsoljuk.
            builder.HasIndex(x => new { x.UserId, x.Name })
                .IsUnique()
                .HasFilter(null);

            builder.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // A Drivvo szerviztípusai. A régi 9 Id megmaradt (néhányat csak átneveztünk),
            // így a már rögzített szervizek kategóriája nem vész el.
            builder.HasData(
                new ServiceCategory { Id = 1, Name = "Olajcsere" },
                new ServiceCategory { Id = 2, Name = "Műszaki ellenőrzés" },
                new ServiceCategory { Id = 3, Name = "Fékek cseréje" },
                new ServiceCategory { Id = 4, Name = "Gumiabroncs" },
                new ServiceCategory { Id = 5, Name = "Vezérlés" },
                new ServiceCategory { Id = 6, Name = "Levegőszűrő" },
                new ServiceCategory { Id = 7, Name = "Akkumulátor" },
                new ServiceCategory { Id = 8, Name = "Szervíz költség" },
                new ServiceCategory { Id = 9, Name = "Szerelés" });

            // A többi típus 10-es Id-tól, a Drivvo-s sorrendben.
            var names = new[]
            {
                "Ablakmosófolyadék", "Ablaktörlők", "Alvázvédő",
                "Blokk tömítés", "Bowden",
                "Desztillált víz", "Digitális kijelző",
                "Ellenőrzés", "Első féktárcsák", "Elsősegély készlet",
                "Fekete festék", "Felfüggesztés", "Felni", "Felső fékhenger", "Feszültségmérő", "Futómű beállítás",
                "Fék rugókészlet", "Fékbetét", "Fékcső", "Fékmunkahenger hátsó", "Fékolaj", "Fékpofa",
                "Féltengely", "Főfékhenger", "Főtengely szimering", "Fűtéskapcsoló", "Fűtő rendszer",
                "Generátor szíj", "Generátor feszültségszabályzó", "Gyújtás", "Gyújtógyertyák", "Gömbfej csere",
                "Használt turbó", "Hengerfej", "Hengerfej csavar", "Hengerfej tömítés", "Hátsó ablaktörlő motor", "Hátsó fékpofa",
                "Hűtő", "Hűtőfolyadék", "Hűtőrendszer", "Hűtőtisztítás",
                "Izzítógyertya",
                "Karburátor", "Karosszéria", "Karter tömítés", "Kerekek cseréje", "Keréknyomás", "Kiegyenlítő tartály",
                "Kiegyenlítő tartály sapka", "Kiegészítő tükör", "Kipufogó rendszer", "Kormánymű", "Kormánymű gumiharang", "Kuplung rendszer",
                "Kézifék bowden", "Kézifékszoknya", "Külső hőmérő szenzor", "Kürt, duda",
                "Lengőkar", "Levegőcső", "Lámpa", "Lámpák", "Lánc", "Láncfeszítő",
                "Lánckerék", "Láncszem", "Légkondícionáló", "Légzsák", "Légzsákspirál",
                "Motor javítása", "Motorolaj", "Műszerfal vízhőmérő",
                "Olaj", "Olajleeresztő csavar", "Olajszűrő",
                "Persely önindító", "Pollenszűrő", "Porlasztócsúcs", "Póttükör", "Pótblokk", "Pótféklámpa",
                "Rendszámtábla világítás búra", "Rádió", "Rádiókeret",
                "Sebességváltó olaj", "Stabilizátor pálcák", "Szelepfedél tömítés", "Szervoolaj csere", "Szénkefe önindítóba", "Szíjak",
                "Telefon adapter", "Termosztát", "Tirisztor", "Turbó felújítás", "Téli gumi", "Tömítés", "Tőcsavar",
                "Vacuumpumpa", "Varrattömítő", "Váltóolaj", "Váltószoknya", "Vízpumpa",
                "szabadonfutó", "Ék", "Övek", "Üveg", "Tükrök", "Üzemanyagpumpa", "Üzemanyagszűrő"
            };

            builder.HasData(names.Select((name, i) => new ServiceCategory { Id = i + 10, Name = name }));
        }
    }
}
