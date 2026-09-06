using System.Globalization;
using System.Text;

namespace TaskOS.Api.Services.Similarity;

public static class FuzzyMatcher
{
    public static double Score(string left, string right)
    {
        var a = Normalize(left);
        var b = Normalize(right);
        if (string.IsNullOrWhiteSpace(a) || string.IsNullOrWhiteSpace(b))
        {
            return 0;
        }

        if (a == b)
        {
            return 1;
        }

        var levenshtein = 1d - (Levenshtein(a, b) / (double)Math.Max(a.Length, b.Length));
        var overlap = TokenOverlap(a, b);
        return Math.Max(levenshtein, overlap);
    }

    public static string Normalize(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var form = value.Trim().Normalize(NormalizationForm.FormKC);
        var builder = new StringBuilder(form.Length);
        foreach (var ch in form)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(ch);
            if (category is UnicodeCategory.NonSpacingMark or UnicodeCategory.Format)
            {
                continue;
            }

            builder.Append(char.ToLowerInvariant(ch));
        }

        return string.Join(' ', builder.ToString().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
    }

    private static double TokenOverlap(string left, string right)
    {
        var a = left.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToHashSet(StringComparer.Ordinal);
        var b = right.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToHashSet(StringComparer.Ordinal);
        if (a.Count == 0 || b.Count == 0)
        {
            return 0;
        }

        var intersection = a.Intersect(b, StringComparer.Ordinal).Count();
        var union = a.Union(b, StringComparer.Ordinal).Count();
        return union == 0 ? 0 : intersection / (double)union;
    }

    private static int Levenshtein(string left, string right)
    {
        var n = left.Length;
        var m = right.Length;
        var prev = new int[m + 1];
        var curr = new int[m + 1];

        for (var j = 0; j <= m; j++)
        {
            prev[j] = j;
        }

        for (var i = 1; i <= n; i++)
        {
            curr[0] = i;
            for (var j = 1; j <= m; j++)
            {
                var cost = left[i - 1] == right[j - 1] ? 0 : 1;
                curr[j] = Math.Min(Math.Min(curr[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost);
            }

            (prev, curr) = (curr, prev);
        }

        return prev[m];
    }
}
