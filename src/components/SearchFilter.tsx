import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, X } from "lucide-react";

interface FilterOption {
  value: string;
  label: string;
}

interface SearchFilterProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: {
    value: string;
    onChange: (value: string) => void;
    options: FilterOption[];
    placeholder?: string;
  }[];
  className?: string;
}

const SearchFilter = ({
  searchTerm,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters = [],
  className = "",
}: SearchFilterProps) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 ${className}`}>
      <div className="w-full sm:w-80 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-10 border-primary/20 focus:border-primary/50 transition-all"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            title="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {filters.map((filter, index) => {
        const defaultValue = filter.options[0]?.value;
        const isActive = filter.value !== defaultValue;
        return (
          <div key={index} className="relative w-full sm:w-56 lg:w-auto lg:min-w-[14rem] lg:max-w-[22rem] lg:flex-1">
            <Select value={filter.value} onValueChange={filter.onChange}>
              <SelectTrigger
                className={`w-full border-primary/20 [&>span]:line-clamp-none [&>span]:truncate ${isActive ? 'pr-9' : ''}`}
                title={filter.value !== 'all' ? filter.value : undefined}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                  <SelectValue placeholder={filter.placeholder || "Filter"} />
                </div>
              </SelectTrigger>
              <SelectContent>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isActive && (
              <button
                type="button"
                onClick={() => filter.onChange(defaultValue)}
                className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10 bg-background rounded"
                title="Clear"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SearchFilter;
