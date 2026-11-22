using System.Globalization;
using System.Text;

namespace Drivenest.Api.Services;

public record DrivvoRefueling(DateTime Date, int OdometerKm, decimal Liters, decimal TotalAmount, bool IsFullTank,
    string? Fuel, string? SecondFuel, string? ThirdFuel)
{
    public bool IsImportable => Liters > 0;
}

// Kiadás vagy szerviz sor, a kettő ugyanúgy néz ki. Szerviznél minden tétel külön sor.
public record DrivvoCost(DateTime Date, int OdometerKm, decimal Amount, string Type, string? Location, string? Notes)
{
    public bool IsImportable => Type != "";
}

public class DrivvoData
{
    public List<DrivvoRefueling> Refuelings { get; } = new();
    public List<DrivvoCost> Expenses { get; } = new();
    public List<DrivvoCost> Services { get; } = new();

    public int? GetMaxOdometerKm()
    {
        var refuelingKm = Refuelings.Where(row => row.IsImportable).Select(row => (int?)row.OdometerKm);
        var costKm = Expenses.Concat(Services).Where(row => row.IsImportable).Select(row => (int?)row.OdometerKm);
        return refuelingKm.Concat(costKm).Max();
    }
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

        using var reader = new StringReader(text);
        while (reader.ReadLine() is { } rawLine)
        {
            var recordStart = ++lineNumber;
            var line = rawLine.TrimStart();
            if (line.Length == 0) continue;

            if (line.StartsWith("##", StringComparison.Ordinal))
            {
                section = line.TrimEnd();
                isHeader = true;
                continue;
            }
            // A fejlécben előfordul idézőjel után írt oszlopszám.
            if (isHeader)
            {
                isHeader = false;
                continue;
            }

            // Ha az első sor nem ## rész, akkor ez nem Drivvo export.
            if (section == "") throw new FormatException("Not a Drivvo export file.");

            try
            {
                var c = ReadFields(reader, line, ref lineNumber);
                if (section == "##Refuelling")
                    data.Refuelings.Add(new DrivvoRefueling(
                        Date(c[1]), Km(c[0]), Math.Round(Number(c[5]), 3), Math.Round(Number(c[4]), 2), c[6] == "Yes",
                        Text(c[2]), c.Length > 7 ? Text(c[7]) : null, c.Length > 12 ? Text(c[12]) : null));
                else if (section == "##Expense")
                    data.Expenses.Add(new DrivvoCost(Date(c[1]), Km(c[0]), Math.Round(Number(c[2]), 2), c[3].Trim(), Text(c[4]), Text(c[8])));
                else if (section == "##Service")
                    data.Services.Add(new DrivvoCost(Date(c[1]), Km(c[0]), Math.Round(Number(c[2]), 2), c[3].Trim(), Text(c[4]), Text(c[7])));
                // A többi rész (pl. bevétel, útvonal) nem kell.
            }
            catch (Exception ex) when (ex is FormatException or IndexOutOfRangeException or OverflowException)
            {
                throw new FormatException($"Invalid row at line {recordStart}.");
            }
        }

        if (section == "") throw new FormatException("Not a Drivvo export file.");
        return data;
    }

    private static string[] ReadFields(StringReader reader, string line, ref int lineNumber)
    {
        var fields = new List<string>();
        var index = 0;
        while (true)
        {
            if (index < line.Length && line[index] == '"')
            {
                fields.Add(ReadQuotedField(reader, ref line, ref index, ref lineNumber));
            }
            else
            {
                var end = line.IndexOf(',', index);
                if (end < 0) end = line.Length;
                var field = line.AsSpan(index, end - index);
                if (field.Contains('"')) throw new FormatException();
                fields.Add(field.ToString());
                index = end;
            }

            if (index == line.Length) return fields.ToArray();
            if (line[index++] != ',') throw new FormatException();
        }
    }

    private static string ReadQuotedField(StringReader reader, ref string line, ref int index, ref int lineNumber)
    {
        var field = new StringBuilder();
        index++;
        while (true)
        {
            var quote = line.IndexOf('"', index);
            if (quote < 0)
            {
                field.Append(line, index, line.Length - index).Append('\n');
                line = reader.ReadLine() ?? throw new FormatException();
                lineNumber++;
                index = 0;
                continue;
            }

            field.Append(line, index, quote - index);
            index = quote + 1;
            if (index < line.Length && line[index] == '"')
            {
                field.Append('"');
                index++;
                continue;
            }

            while (index < line.Length && char.IsWhiteSpace(line[index])) index++;
            return field.ToString();
        }
    }

    private static DateTime Date(string value) => DateTime.ParseExact(value, "yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);

    private static decimal Number(string value) => decimal.Parse(value, CultureInfo.InvariantCulture);

    // Az óraállás tizedessel jön (pl. 149878.0).
    private static int Km(string value) => (int)Number(value);

    private static string? Text(string value)
    {
        value = value.Trim();
        return value == "" ? null : value;
    }
}
