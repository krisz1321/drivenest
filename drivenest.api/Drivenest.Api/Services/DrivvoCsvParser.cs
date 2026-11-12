using System.Globalization;

namespace Drivenest.Api.Services;

public record DrivvoRefueling(DateTime Date, int OdometerKm, decimal Liters, decimal TotalAmount, bool IsFullTank);

// Kiadás vagy szerviz sor, a kettő ugyanúgy néz ki. Szerviznél minden tétel külön sor.
public record DrivvoCost(DateTime Date, int OdometerKm, decimal Amount, string Type, string? Location, string? Notes);

public class DrivvoData
{
    public List<DrivvoRefueling> Refuelings { get; } = new();
    public List<DrivvoCost> Expenses { get; } = new();
    public List<DrivvoCost> Services { get; } = new();
}

// A Drivvo CSV exportját olvassa be. A fájlban ## kezdetű sorok választják el a részeket,
// minden rész első sora a fejléc.
public static class DrivvoCsvParser
{
    public static DrivvoData Parse(string text)
    {
        var data = new DrivvoData();
        var section = "";
        var isHeader = false;
        var lineNumber = 0;

        foreach (var rawLine in text.Split('\n'))
        {
            lineNumber++;
            var line = rawLine.Trim();
            if (line == "") continue;

            if (line.StartsWith("##"))
            {
                section = line;
                isHeader = true;
                continue;
            }
            if (isHeader)
            {
                isHeader = false;
                continue;
            }

            // Ha az első sor nem ## rész, akkor ez nem Drivvo export.
            if (section == "") throw new FormatException("Not a Drivvo export file.");
            if (line.Length < 2) throw new FormatException($"Invalid row at line {lineNumber}.");

            // Minden mező idézőjelben van, ezért elég a "," mentén darabolni.
            var c = line.Substring(1, line.Length - 2).Split("\",\"");

            try
            {
                if (section == "##Refuelling")
                    data.Refuelings.Add(new DrivvoRefueling(Date(c[1]), Km(c[0]), Math.Round(Number(c[5]), 3), Math.Round(Number(c[4]), 2), c[6] == "Yes"));
                else if (section == "##Expense")
                    data.Expenses.Add(new DrivvoCost(Date(c[1]), Km(c[0]), Math.Round(Number(c[2]), 2), c[3].Trim(), Text(c[4]), Text(c[8])));
                else if (section == "##Service")
                    data.Services.Add(new DrivvoCost(Date(c[1]), Km(c[0]), Math.Round(Number(c[2]), 2), c[3].Trim(), Text(c[4]), Text(c[7])));
                // A többi rész (pl. bevétel, útvonal) nem kell.
            }
            catch (Exception ex) when (ex is FormatException or IndexOutOfRangeException or OverflowException)
            {
                throw new FormatException($"Invalid row at line {lineNumber}.");
            }
        }

        if (section == "") throw new FormatException("Not a Drivvo export file.");
        return data;
    }

    private static DateTime Date(string value) => DateTime.ParseExact(value, "yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);

    private static decimal Number(string value) => decimal.Parse(value, CultureInfo.InvariantCulture);

    // Az óraállás tizedessel jön (pl. 149878.0).
    private static int Km(string value) => (int)Number(value);

    private static string? Text(string value)
    {
        value = value.Replace("\"\"", "\"").Trim();
        return value == "" ? null : value;
    }
}
