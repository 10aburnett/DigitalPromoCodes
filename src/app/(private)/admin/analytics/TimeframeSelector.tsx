interface TimeframeSelectorProps {
  value: string;
  onChange: (timeframe: string) => void;
  onCustomDateChange?: (startDate: Date, endDate: Date) => void;
  startDate?: Date;
  endDate?: Date;
  resetCustomDates?: () => void;
}

const TimeframeSelector = ({ value, onChange, onCustomDateChange, startDate, endDate, resetCustomDates }: TimeframeSelectorProps) => {
  return (
    <div className="flex items-center gap-2">
      <div className="bg-[#2b2d36] rounded-lg overflow-hidden flex">
        {["today", "7days", "30days", "alltime", "custom"].map((option) => (
          <button
            key={option}
            className={`px-3 py-2 text-sm ${
              value === option ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-[#343747]"
            }`}
            onClick={() => {
              if (value === "custom" && option !== "custom" && resetCustomDates) {
                resetCustomDates();
              }
              // Show warning for "1 Year" option
              if (option === "alltime") {
                const confirmed = confirm("1 Year view shows data from the last 365 days and may take longer to load. Continue?");
                if (!confirmed) return;
              }
              onChange(option);
            }}
          >
            {option === "today"
              ? "Today"
              : option === "7days"
              ? "7 Days"
              : option === "30days"
              ? "30 Days"
              : option === "alltime"
              ? "1 Year"
              : "Custom"}
          </button>
        ))}
      </div>
      
      {value === "custom" && (
        <div className="flex items-center gap-2">
          <input 
            type="date"
            className="bg-[#2b2d36] text-white text-sm rounded p-2 border border-[#444657]"
            value={startDate ? startDate.toISOString().split('T')[0] : ''}
            onChange={(e) => {
              const newStartDate = e.target.value ? new Date(e.target.value) : new Date();
              if (onCustomDateChange && endDate) {
                onCustomDateChange(newStartDate, endDate);
              }
            }}
          />
          <span className="text-white">to</span>
          <input 
            type="date"
            className="bg-[#2b2d36] text-white text-sm rounded p-2 border border-[#444657]"
            value={endDate ? endDate.toISOString().split('T')[0] : ''}
            onChange={(e) => {
              const newEndDate = e.target.value ? new Date(e.target.value) : new Date();
              if (onCustomDateChange && startDate) {
                onCustomDateChange(startDate, newEndDate);
              }
            }}
          />
        </div>
      )}
    </div>
  );
};

export default TimeframeSelector; 