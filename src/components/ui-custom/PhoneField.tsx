import PhoneInput, { type Value } from "react-phone-number-input";
import "react-phone-number-input/style.css";

interface PhoneFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  defaultCountry?: string;
}

export function PhoneField({ value, onChange, placeholder = "Phone number", defaultCountry = "US" }: PhoneFieldProps) {
  return (
    <PhoneInput
      international
      countryCallingCodeEditable={false}
      defaultCountry={defaultCountry as never}
      value={value as Value}
      onChange={(v) => onChange((v as string) ?? "")}
      placeholder={placeholder}
    />
  );
}
