using AirCharter.API.Model;
using AirCharter.API.Responses.Airports;
using Microsoft.EntityFrameworkCore;

namespace AirCharter.API.Services
{
    public sealed class AirportSearchService(AirCharterExtendedContext context)
    {
        private const int DefaultLimit = 10;
        private const int MaxLimit = 20;
        private const int ExactCandidatesLimit = 100;
        private const int MaxFuzzyDistance = 4;

        private readonly AirCharterExtendedContext _context = context;

        public async Task<IReadOnlyCollection<AirportSearchResponse>> SearchAsync(string query, int limit, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(query))
                return Array.Empty<AirportSearchResponse>();

            int normalizedLimit = NormalizeLimit(limit);
            string normalizedQuery = Normalize(query);

            List<AirportSearchCandidate> exactCandidates = await GetExactCandidatesAsync(query, normalizedQuery, cancellationToken);

            List<AirportSearchCandidate> rankedExactCandidates = exactCandidates
                .Select(airport => new RankedAirportSearchCandidate(
                    airport,
                    CalculateExactScore(airport, normalizedQuery)))
                .OrderBy(candidate => candidate.Score)
                .ThenBy(candidate => candidate.Airport.City)
                .ThenBy(candidate => candidate.Airport.Name)
                .Select(candidate => candidate.Airport)
                .Take(normalizedLimit)
                .ToList();

            if (rankedExactCandidates.Count >= normalizedLimit)
                return rankedExactCandidates.Select(MapResponse).ToList();

            List<AirportSearchCandidate> fuzzyCandidates = await GetFuzzyCandidatesAsync(
                normalizedQuery,
                rankedExactCandidates,
                normalizedLimit,
                cancellationToken);

            return rankedExactCandidates
                .Concat(fuzzyCandidates)
                .Take(normalizedLimit)
                .Select(MapResponse)
                .ToList();
        }

        private async Task<List<AirportSearchCandidate>> GetExactCandidatesAsync(string query, string normalizedQuery, CancellationToken cancellationToken)
        {
            string trimmedQuery = query.Trim();
            string upperQuery = trimmedQuery.ToUpperInvariant();

            return await _context.Airports
                .AsNoTracking()
                .Where(airport =>
                    (airport.Iata != null && airport.Iata == upperQuery) ||
                    (airport.Icao != null && airport.Icao == upperQuery) ||
                    airport.City.ToLower().Contains(normalizedQuery) ||
                    airport.Name.ToLower().Contains(normalizedQuery) ||
                    (airport.Iata != null && airport.Iata.ToLower().Contains(normalizedQuery)) ||
                    (airport.Icao != null && airport.Icao.ToLower().Contains(normalizedQuery)))
                .Select(airport => new AirportSearchCandidate(
                    airport.Id,
                    airport.Name,
                    airport.City,
                    airport.Country,
                    airport.Iata,
                    airport.Icao))
                .Take(ExactCandidatesLimit)
                .ToListAsync(cancellationToken);
        }

        private async Task<List<AirportSearchCandidate>> GetFuzzyCandidatesAsync(string normalizedQuery, List<AirportSearchCandidate> exactCandidates, int limit, CancellationToken cancellationToken)
        {
            HashSet<int> existingAirportIds = exactCandidates
                .Select(airport => airport.Id)
                .ToHashSet();

            List<AirportSearchCandidate> allAirports = await _context.Airports
                .AsNoTracking()
                .Select(airport => new AirportSearchCandidate(
                    airport.Id,
                    airport.Name,
                    airport.City,
                    airport.Country,
                    airport.Iata,
                    airport.Icao))
                .ToListAsync(cancellationToken);

            return allAirports
                .Where(airport => !existingAirportIds.Contains(airport.Id))
                .Select(airport => new RankedAirportSearchCandidate(
                    airport,
                    CalculateFuzzyScore(airport, normalizedQuery)))
                .Where(candidate => candidate.Score <= MaxFuzzyDistance)
                .OrderBy(candidate => candidate.Score)
                .ThenBy(candidate => candidate.Airport.City)
                .ThenBy(candidate => candidate.Airport.Name)
                .Select(candidate => candidate.Airport)
                .Take(limit - exactCandidates.Count)
                .ToList();
        }

        private static int NormalizeLimit(int limit)
        {
            if (limit <= 0)
                return DefaultLimit;

            if (limit > MaxLimit)
                return MaxLimit;

            return limit;
        }

        private static AirportSearchResponse MapResponse(AirportSearchCandidate airport)
        {
            return new AirportSearchResponse
            {
                Id = airport.Id,
                Name = airport.Name,
                City = airport.City,
                Country = airport.Country,
                Iata = airport.Iata,
                Icao = airport.Icao
            };
        }

        private static int CalculateExactScore(AirportSearchCandidate airport, string query)
        {
            string iata = Normalize(airport.Iata);
            string icao = Normalize(airport.Icao);
            string city = Normalize(airport.City);
            string name = Normalize(airport.Name);

            if (iata == query)
                return 0;

            if (icao == query)
                return 1;

            if (city == query)
                return 2;

            if (name == query)
                return 3;

            if (!string.IsNullOrEmpty(iata) && iata.StartsWith(query))
                return 4;

            if (!string.IsNullOrEmpty(icao) && icao.StartsWith(query))
                return 5;

            if (city.StartsWith(query))
                return 6;

            if (name.StartsWith(query))
                return 7;

            if (city.Contains(query))
                return 8;

            if (name.Contains(query))
                return 9;

            if (!string.IsNullOrEmpty(iata) && iata.Contains(query))
                return 10;

            if (!string.IsNullOrEmpty(icao) && icao.Contains(query))
                return 11;

            return 12;
        }

        private static int CalculateFuzzyScore(AirportSearchCandidate airport, string query)
        {
            string iata = Normalize(airport.Iata);
            string icao = Normalize(airport.Icao);
            string city = Normalize(airport.City);
            string name = Normalize(airport.Name);

            int iataDistance = LevenshteinDistance(iata, query);
            int icaoDistance = LevenshteinDistance(icao, query);
            int cityDistance = LevenshteinDistance(city, query);
            int nameDistance = LevenshteinDistance(name, query);

            return Math.Min(
                Math.Min(iataDistance, icaoDistance),
                Math.Min(cityDistance, nameDistance));
        }

        private static string Normalize(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return string.Empty;

            return value.Trim().ToLowerInvariant();
        }

        private static int LevenshteinDistance(string source, string target)
        {
            if (string.IsNullOrEmpty(source))
                return target.Length;

            if (string.IsNullOrEmpty(target))
                return source.Length;

            int[,] matrix = new int[source.Length + 1, target.Length + 1];

            for (int sourceIndex = 0; sourceIndex <= source.Length; sourceIndex++)
                matrix[sourceIndex, 0] = sourceIndex;

            for (int targetIndex = 0; targetIndex <= target.Length; targetIndex++)
                matrix[0, targetIndex] = targetIndex;

            for (int sourceIndex = 1; sourceIndex <= source.Length; sourceIndex++)
            {
                for (int targetIndex = 1; targetIndex <= target.Length; targetIndex++)
                {
                    int cost = source[sourceIndex - 1] == target[targetIndex - 1] ? 0 : 1;

                    int deletion = matrix[sourceIndex - 1, targetIndex] + 1;
                    int insertion = matrix[sourceIndex, targetIndex - 1] + 1;
                    int substitution = matrix[sourceIndex - 1, targetIndex - 1] + cost;

                    matrix[sourceIndex, targetIndex] = Math.Min(
                        Math.Min(deletion, insertion),
                        substitution);
                }
            }

            return matrix[source.Length, target.Length];
        }

        private sealed record AirportSearchCandidate(
            int Id,
            string Name,
            string City,
            string Country,
            string? Iata,
            string? Icao
            );

        private sealed record RankedAirportSearchCandidate(
            AirportSearchCandidate Airport,
            int Score
            );
    }
}