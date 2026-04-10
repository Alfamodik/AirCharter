import { useState, useEffect, useRef } from "react";
import { searchAirports } from "../../api/airportsService";
import type { AirportSearchResponse } from "../../contracts/responses/airports/AirportSearchResponse";
import InputField from "../InputField/InputField"; 
import "./AirportSearch.css";

interface AirportSearchProps {
    label: string;
    onSelect: (id: string) => void;
    value: string;
}

export default function AirportSearch({ label, onSelect, value }: AirportSearchProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<AirportSearchResponse[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!value) setQuery("");
    }, [value]);

    useEffect(() => {
        if (query.length < 2) {
            setResults([]);
            return;
        }

        const delayDebounce = setTimeout(async () => {
            try {
                const data = await searchAirports(query, 5);
                setResults(data);
                setIsOpen(true);
            } catch (err) {
                console.error("Airport search failed", err);
            }
        }, 400);

        return () => clearTimeout(delayDebounce);
    }, [query]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (airport: AirportSearchResponse) => {
        const displayText = `${airport.city} (${airport.iata})`;
        setQuery(displayText);
        onSelect(airport.id.toString());
        setIsOpen(false);
    };

    return (
        <div className="airport-search-container" ref={dropdownRef}>
            <InputField 
                label={label}
                placeholder="Город или IATA..."
                value={query}
                onChange={setQuery}
                onFocus={() => query.length >= 2 && setIsOpen(true)}
            />
            {isOpen && results.length > 0 && (
                <ul className="airport-dropdown">
                    {results.map((airport) => (
                        <li key={airport.id} onClick={() => handleSelect(airport)}>
                            <span className="airport-name">{airport.name}</span>
                            <span className="airport-sub">{airport.city}, {airport.iata}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}