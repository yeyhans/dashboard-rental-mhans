import * as React from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface PlaceSuggestion {
  placeId: string;
  text: string;
  mainText: string;
  secondaryText: string;
}

export interface NormalizedAddress {
  formattedAddress: string;
  street: string | null;
  number: string | null;
  commune: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  postalCode: string | null;
  lat: number | null;
  lng: number | null;
}

/** Street line to store in `direccion` / `billing_address_1`: "Street 123", else the full text. */
export function addressLine(address: NormalizedAddress): string {
  const line = [address.street, address.number].filter(Boolean).join(" ");
  return line || address.formattedAddress;
}

/** City value to store in `ciudad` / `billing_city`: the Chilean commune, else the city. */
export function addressCity(address: NormalizedAddress): string {
  return address.commune || address.city || "";
}

interface AddressInputProps
  extends Omit<
    React.ComponentProps<"input">,
    "value" | "onChange" | "onSelect"
  > {
  value: string;
  onChange: (text: string) => void;
  onSelect: (address: NormalizedAddress) => void;
}

const DEBOUNCE_MS = 250;
const MIN_CHARS = 3;

function newSessionToken(): string {
  return globalThis.crypto.randomUUID();
}

/** Returns null on any failure so the caller can fall back to plain typing. */
async function postPlaces<T>(
  endpoint: string,
  body: unknown,
): Promise<T | null> {
  try {
    // Loaded on demand: the client pulls in the auth stack, which tests and SSR renders of
    // forms embedding this input should not need.
    const { apiClient } = await import("@/services/apiClient");
    const response = await apiClient.post(endpoint, body);
    if (!response.ok) return null;
    const json = (await response.json()) as { success?: boolean; data?: T };
    return json.success ? (json.data ?? null) : null;
  } catch {
    return null;
  }
}

function AddressInput({
  value,
  onChange,
  onSelect,
  className,
  disabled,
  ...props
}: AddressInputProps) {
  const listboxId = React.useId();
  const [suggestions, setSuggestions] = React.useState<PlaceSuggestion[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [hasSearchFailed, setHasSearchFailed] = React.useState(false);
  const sessionTokenRef = React.useRef<string | null>(null);
  const shouldSkipSearchRef = React.useRef(false);

  React.useEffect(() => {
    if (shouldSkipSearchRef.current) {
      shouldSkipSearchRef.current = false;
      return;
    }
    const query = value.trim();
    if (query.length < MIN_CHARS) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      sessionTokenRef.current ??= newSessionToken();
      const data = await postPlaces<PlaceSuggestion[]>(
        "/api/places/autocomplete",
        {
          input: query,
          sessionToken: sessionTokenRef.current,
        },
      );
      if (isCancelled) return;
      setHasSearchFailed(data === null);
      const list = data ?? [];
      setSuggestions(list);
      setActiveIndex(-1);
      setIsOpen(list.length > 0);
    }, DEBOUNCE_MS);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  const selectSuggestion = async (suggestion: PlaceSuggestion) => {
    const sessionToken = sessionTokenRef.current ?? newSessionToken();
    // One session token per selection: the next search starts a new billing session.
    sessionTokenRef.current = null;
    setIsOpen(false);
    setSuggestions([]);
    shouldSkipSearchRef.current = true;
    onChange(suggestion.mainText || suggestion.text);
    const address = await postPlaces<NormalizedAddress>("/api/places/details", {
      placeId: suggestion.placeId,
      sessionToken,
    });
    if (address) onSelect(address);
    else setHasSearchFailed(true);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (!isOpen || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        index <= 0 ? suggestions.length - 1 : index - 1,
      );
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      void selectSuggestion(suggestions[activeIndex]);
    }
  };

  return (
    <div className="relative w-full">
      <Input
        {...props}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
        }
        disabled={disabled}
        value={value}
        className={className}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => setIsOpen(false)}
      />
      {hasSearchFailed && (
        <p role="status" className="mt-1 text-xs text-muted-foreground">
          El buscador de direcciones no está disponible. Puedes escribirla a
          mano.
        </p>
      )}
      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-background text-foreground shadow-md"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.placeId}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              // mouseDown fires before the input blur closes the list.
              onMouseDown={(event) => {
                event.preventDefault();
                void selectSuggestion(suggestion);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm",
                index === activeIndex && "bg-muted",
              )}
            >
              <span className="font-medium">{suggestion.mainText}</span>
              {suggestion.secondaryText && (
                <span className="text-muted-foreground">
                  {" "}
                  {suggestion.secondaryText}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { AddressInput };
