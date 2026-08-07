"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Save, UploadCloud, Loader2, Store as StoreIcon, Settings2, 
  Globe, ShieldCheck, MapPin, Palette, Briefcase, Building2, ChevronDown 
} from "lucide-react";
import { useSocket } from "@/hooks/useSocket"; 
import Select, { components } from "react-select"; 
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

// ✅ DYNAMIC LOCATION PACKAGE
import { Country, State, City } from "country-state-city";

// ==========================================
// CONFIGURATION (Hardcoded values removed)
// ==========================================
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ""; 
// Note: Make sure NEXT_PUBLIC_API_URL is defined in your .env.local
// Example: NEXT_PUBLIC_API_URL=http://localhost:5000

// --- HELPER FUNCTIONS ---
const formatOptions = (arr) => arr.map(item => ({ value: item.value || item.name, label: item.name }));

// ✅ ICON MAPPING FOR LOCATION SELECTS
const locationIcons = {
  country: Globe,
  state: MapPin,
  city: Building2,
};

// ✅ CUSTOM REACT-SELECT COMPONENTS WITH INTEGRATED ICONS
const createLocationComponents = (type) => ({
  Control: ({ children, ...props }) => {
    const Icon = locationIcons[type];
    return (
      <components.Control {...props}>
        <div className="flex items-center gap-2 pl-2.5 text-[var(--text-muted)]">
          <Icon size={14} className="shrink-0" />
          <div className="h-4 w-[1px] bg-[var(--border-color)]" />
        </div>
        {children}
      </components.Control>
    );
  },
  Option: ({ children, ...props }) => {
    const Icon = locationIcons[type];
    return (
      <components.Option {...props}>
        <div className="flex items-center gap-2.5">
          <Icon size={13} className="shrink-0 text-[var(--text-muted)]" />
          <span>{children}</span>
        </div>
      </components.Option>
    );
  },
  DropdownIndicator: (props) => (
    <components.DropdownIndicator {...props}>
      <ChevronDown size={14} className="text-[var(--text-muted)]" />
    </components.DropdownIndicator>
  ),
  IndicatorSeparator: () => null,
});

export default function StoreInfoPage() {
  const { socket, isConnected } = useSocket(); 
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoFile, setLogoFile] = useState(null);

  // ✅ INITIAL STATE - Hardcoded defaults removed/neutralized
  const [formData, setFormData] = useState({
    store_name: "", 
    tagline: "", 
    email: "", 
    phone: "", 
    support_email: "", 
    support_phone: "",
    country: "", // ❌ Removed "PK" hardcoded default
    city: "", 
    state: "", 
    zip_code: "", 
    address: "",
    currency: "", // ❌ Removed "PKR" hardcoded default
    tax_rate: 0, 
    weight_unit: "kg", // Kept 'kg' as safe technical default, or use ""
    store_status: "open", // Kept 'open' as logical default
    maintenance_message: "",
    primary_color: "#10b981", // Kept color default for UI stability, ideally from DB
    meta_title: "", 
    meta_description: "", 
    meta_keywords: "",
    return_policy: "", 
    privacy_policy: "", 
    terms_conditions: "",
    social_links: { facebook: "", instagram: "", twitter: "", whatsapp: "", youtube: "", tiktok: "" },
  });

  // ✅ FETCH ALL COUNTRIES ONCE
  const countryOptions = useMemo(() => {
    return Country.getAllCountries().map(c => ({ value: c.isoCode, label: c.name }));
  }, []);

  // ✅ DYNAMIC STATES BASED ON COUNTRY
  const currentStates = useMemo(() => {
    if (!formData.country) return [];
    return State.getStatesOfCountry(formData.country).map(s => ({ value: s.isoCode, label: s.name }));
  }, [formData.country]);

  // ✅ DYNAMIC CITIES BASED ON COUNTRY + STATE
  const currentCities = useMemo(() => {
    if (!formData.country || !formData.state) return [];
    return City.getCitiesOfState(formData.country, formData.state).map(c => ({ value: c.name, label: c.name }));
  }, [formData.country, formData.state]);

  // ✅ SOCKET SE DATA FETCH KARNA
  useEffect(() => {
    if (!socket || !isConnected) {
      if(!isConnected) setFetching(false); 
      return;
    }

    socket.emit("getStoreInfo");

    const handleStoreData = (response) => {
      if (response.success && response.data) {
        const data = response.data;
        setFormData(prev => ({ ...prev, ...data, social_links: data.social_links || prev.social_links }));
        
        // ✅ FIXED: Dynamic API URL instead of hardcoded localhost
        if (data.logo?.img_url) {
          setLogoPreview(`${API_BASE_URL}/${data.logo.img_url}`);
        }
      }
      setFetching(false);
    };

    socket.on("storeInfo", handleStoreData);

    const handleStoreUpdate = (updatedStoreData) => {
      setFormData(prev => ({ ...prev, ...updatedStoreData, social_links: updatedStoreData.social_links || prev.social_links }));
      
      // ✅ FIXED: Dynamic API URL
      if (updatedStoreData.logo?.img_url) {
        setLogoPreview(`${API_BASE_URL}/${updatedStoreData.logo.img_url}`);
      }
    };
    socket.on("storeUpdated", handleStoreUpdate);

    return () => { 
      socket.off("storeInfo", handleStoreData);
      socket.off("storeUpdated", handleStoreUpdate); 
    };
  }, [socket, isConnected]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("social_")) {
      const key = name.replace("social_", "");
      setFormData((prev) => ({ ...prev, social_links: { ...prev.social_links, [key]: value } }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handlePhoneChange = (value, name) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ✅ CASCADE LOGIC
  const handleSelectChange = (selectedOption, actionMeta) => {
    const name = actionMeta.name;
    const value = selectedOption ? selectedOption.value : "";

    if (name === "country") {
      setFormData(prev => ({ ...prev, country: value, state: "", city: "" }));
    } else if (name === "state") {
      setFormData(prev => ({ ...prev, state: value, city: "" }));
    } else if (name === "city") {
      setFormData(prev => ({ ...prev, city: value }));
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  // ✅ SOCKET SE FORM SUBMIT
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!socket || !isConnected) {
      alert("Server se connection nahi hai. Please wait...");
      return;
    }

    setLoading(true);

    let logoBase64 = null;
    if (logoFile) {
      const reader = new FileReader();
      logoBase64 = await new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(logoFile);
      });
    }

    const payload = {
      ...formData,
      logoBase64: logoBase64
    };

    socket.emit("updateStoreInfo", payload, (response) => {
      if (response && response.success) {
        alert("Store Info Updated Successfully!");
        setLogoFile(null);
        
        // ✅ FIXED: Dynamic API URL
        if (response.data?.logo?.img_url) {
          setLogoPreview(`${API_BASE_URL}/${response.data.logo.img_url}`);
        }
      } else {
        alert(response?.message || "Failed to update store info");
      }
      setLoading(false);
    });
  };

  if (fetching) return (
    <div className="flex h-screen items-center justify-center bg-[var(--bg-main)]">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
    </div>
  );

  // --- STYLES ---
  const sectionClass = "rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-sm";
  const inputClass = "w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500 focus:bg-[var(--bg-input)] transition-colors";
  const labelClass = "block text-[11px] font-medium text-[var(--text-secondary)] mb-1.5";
  const sectionTitleClass = "text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4 pb-2 border-b border-[var(--border-color)]";

  const selectStyles = {
    control: (base) => ({ 
      ...base, backgroundColor: "var(--bg-input)", borderColor: "var(--border-color)", 
      minHeight: "34px", height: "34px", fontSize: "13px", borderRadius: "6px", 
      boxShadow: "none", "&:hover": { borderColor: "var(--border-color)" } 
    }),
    valueContainer: (base) => ({ ...base, padding: "0 10px", height: "32px" }),
    input: (base) => ({ ...base, margin: 0, padding: 0, color: "var(--text-primary)" }),
    indicatorsContainer: (base) => ({ ...base, height: "32px" }),
    dropdownIndicator: (base) => ({ ...base, padding: "0 6px", color: "var(--text-muted)" }),
    menu: (base) => ({ 
      ...base, backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", 
      borderRadius: "6px", marginTop: "4px", zIndex: 9999, 
      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)" 
    }),
    option: (base, state) => ({ 
      ...base, 
      backgroundColor: state.isSelected ? "var(--bg-sidebar-hover)" : state.isFocused ? "var(--bg-sidebar-hover)" : "transparent", 
      color: state.isSelected ? "var(--text-primary)" : "var(--text-secondary)", 
      fontSize: "13px", padding: "8px 12px", cursor: "pointer" 
    }),
    singleValue: (base) => ({ ...base, color: "var(--text-primary)" }),
    placeholder: (base) => ({ ...base, color: "var(--text-muted)", fontSize: "13px" }),
  };

  const phoneInputStyles = {
    containerStyle: { width: "100%" },
    inputStyle: { 
      width: "100%", backgroundColor: "var(--bg-input)", border: "1px solid var(--border-color)", 
      borderRadius: "6px", color: "var(--text-primary)", fontSize: "13px", 
      paddingLeft: "48px", height: "34px", outline: "none", caretColor: "var(--text-primary)" 
    },
    buttonStyle: { 
      backgroundColor: "transparent", border: "none", 
      borderBottomLeftRadius: "6px", borderTopLeftRadius: "6px", 
      borderRight: "1px solid var(--border-color)" 
    },
    dropdownStyle: { 
      backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", 
      borderRadius: "6px", color: "var(--text-primary)", zIndex: 9999 
    },
    searchStyle: { 
      backgroundColor: "var(--bg-input)", color: "var(--text-primary)", 
      border: "1px solid var(--border-color)", borderRadius: "4px" 
    }
  };

  return (
    <>
      {/* ✅ GLOBAL CSS FIXES */}
      <style jsx global>{`
        input:-webkit-autofill, input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px var(--bg-input) inset !important;
          -webkit-text-fill-color: var(--text-primary) !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        .react-tel-input .form-control {
          background-color: var(--bg-input) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
        }
        .react-tel-input .form-control:focus {
          background-color: var(--bg-input) !important;
          border-color: #10b981 !important;
          box-shadow: none !important;
        }
        .react-tel-input .flag-dropdown {
          background-color: transparent !important;
          border-color: var(--border-color) !important;
          border-bottom-left-radius: 6px !important;
          border-top-left-radius: 6px !important;
        }
        .react-tel-input .selected-flag:hover, 
        .react-tel-input .selected-flag:focus {
          background-color: rgba(255, 255, 255, 0.05) !important;
        }
        .react-tel-input .country-list {
          background-color: var(--bg-card) !important;
          border-color: var(--border-color) !important;
          color: var(--text-primary) !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5) !important;
        }
        .react-tel-input .country-list .search {
          background-color: var(--bg-input) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
        }
        .react-tel-input .country-list .country:hover,
        .react-tel-input .country-list .country.highlight {
          background-color: var(--bg-sidebar-hover) !important;
        }
        .react-tel-input .country-list .divider {
          border-bottom-color: var(--border-color) !important;
        }
      `}</style>

      <div className="min-h-screen bg-[var(--bg-main)] pt-2 px-2 pb-16">
        
        <div className="mx-auto max-w-7xl space-y-4">
          
          {/* Header */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-1">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-emerald-500" />
              <h1 className="text-lg font-bold text-[var(--text-primary)]">Store Settings</h1>
            </div>
            <button 
              onClick={handleSubmit} 
              disabled={loading || !isConnected} 
              className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* 1. GENERAL & CONTACT */}
            <div className={sectionClass}>
              <h2 className={sectionTitleClass}><StoreIcon size={16} className="text-emerald-500"/> General & Contact</h2>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Store Name *</label>
                  <input type="text" name="store_name" value={formData.store_name} onChange={handleChange} className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>Tagline</label>
                  <input type="text" name="tagline" value={formData.tagline} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Primary Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Primary Phone</label>
                  <PhoneInput
                    country={"pk"} // Default UI country code, can be dynamic if needed
                    value={formData.phone}
                    onChange={(val) => handlePhoneChange(val, "phone")}
                    inputProps={{ name: "phone" }}
                    containerStyle={phoneInputStyles.containerStyle}
                    inputStyle={phoneInputStyles.inputStyle}
                    buttonStyle={phoneInputStyles.buttonStyle}
                    dropdownStyle={phoneInputStyles.dropdownStyle}
                    searchStyle={phoneInputStyles.searchStyle}
                    enableSearch={true}
                    searchPlaceholder="Search country..."
                    preferredCountries={["pk", "in", "us", "gb", "ae"]}
                  />
                </div>
                <div>
                  <label className={labelClass}>Support Email</label>
                  <input type="email" name="support_email" value={formData.support_email} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Support Phone</label>
                  <PhoneInput
                    country={"pk"}
                    value={formData.support_phone}
                    onChange={(val) => handlePhoneChange(val, "support_phone")}
                    inputProps={{ name: "support_phone" }}
                    containerStyle={phoneInputStyles.containerStyle}
                    inputStyle={phoneInputStyles.inputStyle}
                    buttonStyle={phoneInputStyles.buttonStyle}
                    dropdownStyle={phoneInputStyles.dropdownStyle}
                    searchStyle={phoneInputStyles.searchStyle}
                    enableSearch={true}
                    searchPlaceholder="Search country..."
                    preferredCountries={["pk", "in", "us", "gb", "ae"]}
                  />
                </div>
              </div>
            </div>

            {/* 2. BRANDING & THEME */}
            <div className={sectionClass}>
              <h2 className={sectionTitleClass}><Palette size={16} className="text-purple-400"/> Branding & Theme</h2>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className={labelClass}>Store Logo</label>
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md border border-[var(--border-color)] bg-[var(--bg-input)]">
                      {logoPreview 
                        ? <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" /> 
                        : <StoreIcon className="h-6 w-6 text-[var(--text-muted)]" />
                      }
                    </div>
                    <label className="cursor-pointer rounded-md border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-sidebar-hover)] flex items-center gap-2 transition-colors">
                      <UploadCloud size={14} /> Upload
                      <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                    </label>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Theme Color</label>
                  <div className="flex items-center gap-3">
                    <div className="relative h-8 w-8 overflow-hidden rounded-md border border-[var(--border-color)]">
                      <input type="color" name="primary_color" value={formData.primary_color} onChange={handleChange} className="absolute -left-2 -top-2 h-14 w-14 cursor-pointer border-0 p-0" />
                    </div>
                    <input type="text" name="primary_color" value={formData.primary_color} onChange={handleChange} className={`${inputClass} font-mono`} />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. BUSINESS & OPERATIONS */}
            <div className={sectionClass}>
              <h2 className={sectionTitleClass}><Briefcase size={16} className="text-blue-400"/> Business & Operations</h2>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-3">
                <div>
                  <label className={labelClass}>Currency</label>
                  <input type="text" name="currency" value={formData.currency} onChange={handleChange} className={inputClass} placeholder="e.g. PKR, USD" />
                </div>
                <div>
                  <label className={labelClass}>Tax Rate (%)</label>
                  <input type="number" name="tax_rate" value={formData.tax_rate} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Weight Unit</label>
                  <select name="weight_unit" value={formData.weight_unit} onChange={handleChange} className={inputClass}>
                    <option value="kg" className="bg-[var(--bg-card)]">Kilograms (kg)</option>
                    <option value="g" className="bg-[var(--bg-card)]">Grams (g)</option>
                    <option value="lbs" className="bg-[var(--bg-card)]">Pounds (lbs)</option>
                  </select>
                </div>
                <div className="md:col-span-3 mt-1">
                  <label className={labelClass}>Store Status</label>
                  <select name="store_status" value={formData.store_status} onChange={handleChange} className={inputClass}>
                    <option value="open" className="bg-[var(--bg-card)]">Open (Live)</option>
                    <option value="closed" className="bg-[var(--bg-card)]">Closed (Temporarily)</option>
                    <option value="maintenance" className="bg-[var(--bg-card)]">Maintenance Mode</option>
                  </select>
                </div>
                {formData.store_status === 'maintenance' && (
                  <div className="md:col-span-3">
                    <label className={labelClass}>Maintenance Message</label>
                    <textarea name="maintenance_message" value={formData.maintenance_message} onChange={handleChange} rows="2" className={inputClass}></textarea>
                  </div>
                )}
              </div>
            </div>

            {/* ✅ 4. ADDRESS */}
            <div className={sectionClass}>
              <h2 className={sectionTitleClass}><MapPin size={16} className="text-orange-400"/> Address Details</h2>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
                
                <div>
                  <label className={labelClass}>Country</label>
                  <Select 
                    name="country" 
                    options={countryOptions} 
                    value={countryOptions.find(c => c.value === formData.country)} 
                    onChange={handleSelectChange} 
                    styles={selectStyles} 
                    components={createLocationComponents("country")}
                    isSearchable={true} 
                    placeholder="Select Country..." 
                  />
                </div>

                <div>
                  <label className={labelClass}>State / Province</label>
                  <Select 
                    name="state" 
                    options={currentStates} 
                    value={currentStates.find(s => s.value === formData.state)} 
                    onChange={handleSelectChange} 
                    styles={selectStyles} 
                    components={createLocationComponents("state")}
                    isSearchable={true} 
                    placeholder={formData.country ? "Select State..." : "Select Country First"} 
                    isDisabled={!formData.country}
                  />
                </div>

                <div>
                  <label className={labelClass}>City</label>
                  <Select 
                    name="city" 
                    options={currentCities} 
                    value={currentCities.find(c => c.value === formData.city)} 
                    onChange={handleSelectChange} 
                    styles={selectStyles} 
                    components={createLocationComponents("city")}
                    isSearchable={true} 
                    placeholder={formData.state ? "Select City..." : "Select State First"} 
                    isDisabled={!formData.state}
                  />
                </div>

                <div>
                  <label className={labelClass}>Zip / Postal Code</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-muted)]">
                      <span className="text-xs font-bold">#</span>
                    </div>
                    <input 
                      type="text" 
                      name="zip_code" 
                      value={formData.zip_code} 
                      onChange={handleChange} 
                      className={`${inputClass} pl-8`} 
                      placeholder="e.g. 54000"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className={labelClass}>Street Address</label>
                  <input 
                    type="text" 
                    name="address" 
                    value={formData.address} 
                    onChange={handleChange} 
                    className={inputClass} 
                    placeholder="House #, Street, Area, Landmark"
                  />
                </div>
              </div>
            </div>

            {/* 5. SEO SETTINGS */}
            <div className={sectionClass}>
              <h2 className={sectionTitleClass}><Globe size={16} className="text-cyan-400"/> SEO & Meta</h2>
              <div className="grid grid-cols-1 gap-y-4">
                <div>
                  <label className={labelClass}>Meta Title</label>
                  <input type="text" name="meta_title" value={formData.meta_title} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Meta Description</label>
                  <textarea name="meta_description" value={formData.meta_description} onChange={handleChange} rows="2" className={`${inputClass} resize-none`}></textarea>
                </div>
              </div>
            </div>

            {/* 6. SOCIAL LINKS */}
            <div className={sectionClass}>
              <h2 className={sectionTitleClass}>Social Media</h2>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
                {["facebook", "instagram", "twitter", "whatsapp", "youtube", "tiktok"].map((social) => (
                  <div key={social}>
                    <label className={`${labelClass} capitalize`}>{social}</label>
                    <input 
                      type="text" 
                      name={`social_${social}`} 
                      value={formData.social_links[social]} 
                      onChange={handleChange} 
                      placeholder={`https://${social}.com/...`} 
                      className={inputClass} 
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 7. LEGAL POLICIES */}
            <div className={sectionClass}>
              <h2 className={sectionTitleClass}><ShieldCheck size={16} className="text-rose-400"/> Legal Policies</h2>
              <div className="grid grid-cols-1 gap-y-4">
                <div>
                  <label className={labelClass}>Return Policy</label>
                  <textarea name="return_policy" value={formData.return_policy} onChange={handleChange} rows="2" className={`${inputClass} resize-none`}></textarea>
                </div>
                <div>
                  <label className={labelClass}>Privacy Policy</label>
                  <textarea name="privacy_policy" value={formData.privacy_policy} onChange={handleChange} rows="2" className={`${inputClass} resize-none`}></textarea>
                </div>
                <div>
                  <label className={labelClass}>Terms & Conditions</label>
                  <textarea name="terms_conditions" value={formData.terms_conditions} onChange={handleChange} rows="2" className={`${inputClass} resize-none`}></textarea>
                </div>
              </div>
            </div>

          </form>
        </div>
      </div>
    </>
  );
}