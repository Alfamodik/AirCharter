import { useEffect, useRef, useState } from "react";
import { searchAirports } from "../../api/airportsService";
import type { AirportSearchResponse } from "../../contracts/responses/airports/airportSearchResponse";
import InputField from "../inputField/InputField";
import "./AirportSearch.css";

export type AirportSelection = {
    id: string;
    displayName: string;
    airport: AirportSearchResponse;
};

interface AirportSearchProps {
    label: string;
    selectedAirportId: string;
    selectedAirportDisplayName: string;
    onSelect: (airport: AirportSelection) => void;
}

function buildAirportDisplayName(airport: AirportSearchResponse): string {
    const code = airport.iata || airport.icao;
    const city = airport.city || airport.country || airport.name;

    if (!code) {
        return city;
    }

    return `${city} (${code})`;
}

export default function AirportSearch({
    label,
    selectedAirportId,
    selectedAirportDisplayName,
    onSelect
}: AirportSearchProps) {
    const [query, setQuery] = useState(selectedAirportDisplayName);
    const [results, setResults] = useState<AirportSearchResponse[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const skipSearchRef = useRef(false);

    useEffect(() => {
        skipSearchRef.current = true;
        setQuery(selectedAirportDisplayName);
        setResults([]);
        setIsOpen(false);
    }, [selectedAirportId, selectedAirportDisplayName]);

    useEffect(() => {
        if (skipSearchRef.current) {
            skipSearchRef.current = false;
            return;
        }

        if (query.trim().length < 2) {
            setResults([]);
            setIsOpen(false);
            return;
        }

        const debounceTimeout = window.setTimeout(async () => {
            try {
                const data = await searchAirports(query, 5);
                setResults(data);
                setIsOpen(true);
            } catch {
                setResults([]);
                setIsOpen(false);
            }
        }, 400);

        return () => window.clearTimeout(debounceTimeout);
    }, [query]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    function handleSelect(airport: AirportSearchResponse) {
        const displayName = buildAirportDisplayName(airport);

        setQuery(displayName);
        setResults([]);
        setIsOpen(false);

        onSelect({
            id: airport.id.toString(),
            displayName,
            airport
        });
    }

    return (
        <div className="airport-search-container" ref={dropdownRef}>
            <InputField
                label={label}
                placeholder="Город, страна, или код..."
                value={query}
                onChange={setQuery}
                onFocus={() => {
                    if (results.length > 0) {
                        setIsOpen(true);
                    }
                }}
                autoComplete="off"
            />

            {isOpen && results.length > 0 && (
                <ul className="airport-dropdown">
                    {results.map((airport) => (
                        <li key={airport.id} onClick={() => handleSelect(airport)}>
                            <span className="airport-name">{airport.name}</span>
                            <span className="airport-sub">
                                {airport.city}
                                {(airport.iata || airport.icao) && `, ${airport.iata || airport.icao}`}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
