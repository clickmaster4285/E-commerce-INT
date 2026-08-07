"use client";
import React, { useState, useMemo, useRef, useEffect } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { brandApi } from "../../../../apis/brandApi";
import { Country } from "country-state-city";

// ✅ 1. SOCKET HOOK IMPORT KIYA
import { useBrandSocketSync } from "@/hooks/useBrandSocketSync.js";

/* ================= Icons ================= */
function Ico(props) {
  return React.createElement("svg", {
    className: props.className || "w-4 h-4",
    fill: "none", stroke: "currentColor", viewBox: "0 0 24 24"
  }, React.createElement("path", {
    strokeLinecap: "round", strokeLinejoin: "round",
    strokeWidth: props.sw || 2, d: props.d
  }));
}

var D = {
  back: "M15 19l-7-7 7-7",
  edit: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
  trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3",
  close: "M6 18L18 6M6 6l12 12",
  upload: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
  image: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  link: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14",
  down: "M19 9l-7 7-7-7",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  check: "M5 13l4 4L19 7",
  globe: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  plus: "M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z",
  pencil: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  warn: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  box: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  tag: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
  cube: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",
  layers: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  chevron: "M9 5l7 7-7 7",
  dots: "M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z",
  eye: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
};

function Spin(cls) {
  return React.createElement("svg", { className: (cls || "w-4 h-4") + " animate-spin", fill: "none", viewBox: "0 0 24 24" },
    React.createElement("circle", { className: "opacity-25", cx: 12, cy: 12, r: 10, stroke: "currentColor", strokeWidth: 4 }),
    React.createElement("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" })
  );
}

/* ================= Helpers ================= */
function ini(n) { return n ? n.split(" ").map(function(w){return w[0]}).join("").substring(0,2).toUpperCase() : "??"; }
function lurl(b) { if(b&&b.logo&&b.logo.img_url){return b.logo.img_url.startsWith("http")?b.logo.img_url:"http://localhost:5000/"+b.logo.img_url;} return ""; }
function fd(d) { return d?new Date(d).toLocaleDateString("en-US",{day:"numeric",month:"short",year:"numeric"}):"—"; }
function fdt(d) { return d?new Date(d).toLocaleDateString("en-US",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—"; }
function tago(d) { if(!d)return""; var m=Math.floor((Date.now()-new Date(d).getTime())/60000); if(m<1)return"now"; if(m<60)return m+"m ago"; var h=Math.floor(m/60); if(h<24)return h+"h ago"; var dy=Math.floor(h/24); return dy<30?dy+"d ago":fd(d); }
function fsz(b) { if(!b)return"—"; if(b<1024)return b+" B"; if(b<1048576)return(b/1024).toFixed(1)+" KB"; return(b/1048576).toFixed(2)+" MB"; }

/* ================= Components ================= */

function StatusPill(props) {
  var on = props.active;
  var c = on?"#34d399":"#f87171";
  return React.createElement("span", {
    className: "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium",
    style: { backgroundColor: on?"rgba(16,185,129,0.08)":"rgba(239,68,68,0.08)", color: c }
  }, React.createElement("span", {className:"w-1 h-1 rounded-full",style:{backgroundColor:c}}), on?"Active":"Inactive");
}

function InfoRow(props) {
  return React.createElement("div", {className:"flex justify-between items-center py-2.5"},
    React.createElement("span", {className:"text-[12px]",style:{color:"var(--text-muted)"}}, props.label),
    React.createElement("span", {
      className:"text-[12px] text-right truncate max-w-[55%] "+(props.mono?"font-mono":""),
      style:{color:props.green?"#34d399":"var(--text-primary)"}
    }, props.value||"—")
  );
}

function SecTitle(props) {
  return React.createElement("div", {
    className:"text-[11px] font-semibold uppercase tracking-wide mb-3 pb-2.5",
    style:{color:"var(--text-muted)",borderBottom:"1px solid var(--border-color)"}
  }, props.children);
}

function InnerCard(props) {
  return React.createElement("div", {
    className:"rounded-xl p-4",
    style:{
      backgroundColor:"transparent",
      border:"1px solid var(--border-color)",
      borderRadius:"12px"
    }
  }, props.children);
}

function SBtn(props) {
  var hs = useState(false); var hov = hs[0]; var setHov = hs[1];
  var bg, cl;
  if (props.danger) {
    bg = hov ? "rgba(239,68,68,0.1)" : "transparent";
    cl = "#f87171";
  } else if (props.primary) {
    bg = "var(--accent)";
    cl = "var(--accent-text)";
  } else {
    bg = hov ? "rgba(255,255,255,0.06)" : "transparent";
    cl = "var(--text-secondary)";
  }
  return React.createElement("button", {
    type: props.type||"button", onClick: props.onClick, disabled: props.disabled,
    onMouseEnter: function(){setHov(true);}, onMouseLeave: function(){setHov(false);},
    className: "h-7 px-2.5 rounded-md text-[12px] font-medium inline-flex items-center gap-1 transition-all duration-150 disabled:opacity-40 cursor-pointer",
    style: { backgroundColor: bg, color: cl, border: "none" }
  }, props.children);
}

function Person(props) {
  var c = props.color||"#34d399";
  var bg = c==="#60a5fa"?"rgba(96,165,250,0.1)":"rgba(52,211,153,0.1)";
  if (!props.user) {
    return React.createElement("div", {className:"py-2.5"},
      React.createElement("p", {className:"text-[10px] font-medium uppercase tracking-wide mb-1",style:{color:c}}, props.label),
      React.createElement("p", {className:"text-[11px]",style:{color:"var(--text-muted)"}}, props.fallback||"Unknown")
    );
  }
  return React.createElement("div", {className:"py-2.5"},
    React.createElement("div", {className:"flex items-center justify-between mb-1.5"},
      React.createElement("p", {className:"text-[10px] font-medium uppercase tracking-wide",style:{color:c}}, props.label),
      props.date?React.createElement("span", {className:"text-[10px]",style:{color:"var(--text-muted)"}}, fd(props.date)+" · "+tago(props.date)):null
    ),
    React.createElement("div", {className:"flex items-center gap-2.5"},
      React.createElement("div", {className:"w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0",style:{backgroundColor:bg,color:c}}, ini(props.user.name)),
      React.createElement("div", {className:"min-w-0"},
        React.createElement("p", {className:"text-[12px] font-medium truncate",style:{color:"var(--text-primary)"}}, props.user.name||"Unknown"),
        props.user.email?React.createElement("p", {className:"text-[10px] truncate",style:{color:"var(--text-muted)"}}, props.user.email):null
      )
    )
  );
}

function TItem(props) {
  var c = props.color||"#34d399";
  var bg = c==="#60a5fa"?"rgba(96,165,250,0.1)":"rgba(52,211,153,0.1)";
  return React.createElement("div", {className:"flex gap-3"},
    React.createElement("div", {className:"flex flex-col items-center"},
      React.createElement("div", {className:"w-8 h-8 rounded-full flex items-center justify-center shrink-0",style:{backgroundColor:bg,color:c}}, props.icon),
      !props.last?React.createElement("div", {className:"w-px flex-1 my-1",style:{backgroundColor:"var(--border-color)"}}):null
    ),
    React.createElement("div", {className:"flex-1 min-w-0 "+(props.last?"":"pb-4")},
      React.createElement("div", {className:"flex items-start justify-between gap-2"},
        React.createElement("div", null,
          React.createElement("p", {className:"text-[12px] font-medium",style:{color:"var(--text-primary)"}}, props.title),
          props.sub?React.createElement("p", {className:"text-[10px] mt-0.5",style:{color:"var(--text-muted)"}}, props.sub):null
        ),
        React.createElement("div", {className:"text-right shrink-0"},
          React.createElement("p", {className:"text-[10px]",style:{color:"var(--text-secondary)"}}, fd(props.date)),
          React.createElement("p", {className:"text-[9px]",style:{color:"var(--text-muted)"}}, tago(props.date))
        )
      ),
      props.user?React.createElement("div", {
        className:"flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-lg",
        style:{border:"1px solid var(--border-color)",borderRadius:"8px"}
      },
        React.createElement("div", {className:"w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0",style:{backgroundColor:bg,color:c}}, ini(props.user.name)),
        React.createElement("div", {className:"min-w-0"},
          React.createElement("p", {className:"text-[11px] font-medium truncate",style:{color:"var(--text-primary)"}}, props.user.name||"?"),
          props.user.email?React.createElement("p", {className:"text-[9px] truncate",style:{color:"var(--text-muted)"}}, props.user.email):null
        )
      ):null
    )
  );
}

/* =============================================================
   CDD — Country Dropdown (opens UPWARD)
   ============================================================= */
function CDD(props) {
  var ref=useRef(null), inp=useRef(null);
  var s1=useState(false),open=s1[0],setOpen=s1[1];
  var s2=useState(""),srch=s2[0],setSrch=s2[1];
  var all=props.allCountries||[];
  function flag(iso){if(!iso||iso.length!==2)return"🌍";return iso.toUpperCase().split("").map(function(c){return String.fromCodePoint(127397+c.charCodeAt(0))}).join("")}
  var filtered=useMemo(function(){if(!srch.trim())return all;var t=srch.toLowerCase();return all.filter(function(c){return c.name.toLowerCase().indexOf(t)!==-1})},[all,srch]);
  var sel=useMemo(function(){return all.find(function(c){return c.name===props.value})||null},[all,props.value]);
  useEffect(function(){function h(e){if(ref.current&&!ref.current.contains(e.target)){setOpen(false);setSrch("")}}document.addEventListener("mousedown",h);return function(){document.removeEventListener("mousedown",h)}},[]);
  useEffect(function(){if(open&&inp.current)setTimeout(function(){inp.current.focus()},30);if(!open)setSrch("")},[open]);

  return React.createElement("div", {ref:ref,className:"relative"},
    React.createElement("button", {type:"button",onClick:function(){if(!props.disabled)setOpen(!open)},disabled:props.disabled,
      className:"h-8 w-full px-2.5 rounded-lg text-[12px] flex items-center justify-between gap-1.5 outline-none disabled:opacity-40 cursor-pointer",
      style:{backgroundColor:"var(--bg-tertiary)",border:"1px solid var(--border-color)",color:"var(--text-primary)",borderRadius:"8px"}
    },
      React.createElement("span", {className:"flex items-center gap-1.5 min-w-0 truncate"},
        sel?React.createElement(React.Fragment,null,React.createElement("span",{className:"text-sm leading-none"},flag(sel.isoCode)),React.createElement("span",{className:"truncate"},sel.name))
          :React.createElement("span",{style:{color:"var(--text-muted)"}},React.createElement(Ico,{d:D.globe,className:"w-3 h-3"})," Select...")
      ),
      Ico({d:D.down,className:"w-3 h-3 shrink-0"})
    ),
    open?React.createElement("div", {className:"absolute z-50 mb-1 w-full rounded-xl overflow-hidden shadow-xl bottom-full left-0",
      style:{backgroundColor:"var(--bg-card)",border:"1px solid var(--border-color)",boxShadow:"0 -8px 24px rgba(0,0,0,0.4)",borderRadius:"12px"}
    },
      React.createElement("div", {className:"p-1.5 relative",style:{borderBottom:"1px solid var(--border-color)"}},
        React.createElement("input", {ref:inp,type:"text",value:srch,onChange:function(e){setSrch(e.target.value)},placeholder:"Search...",
          className:"w-full h-7 pl-7 pr-2 rounded-lg text-[11px] outline-none",
          style:{backgroundColor:"var(--bg-tertiary)",border:"1px solid var(--border-color)",color:"var(--text-primary)",borderRadius:"8px"}}),
        React.createElement("span", {className:"absolute left-3.5 top-1/2 -translate-y-1/2",style:{color:"var(--text-muted)"}},
          React.createElement(Ico,{d:D.search,className:"w-3 h-3"}))
      ),
      React.createElement("div", {className:"max-h-[180px] overflow-y-auto py-0.5",style:{scrollbarWidth:"thin"}},
        filtered.length===0?React.createElement("p",{className:"px-3 py-3 text-center text-[11px]",style:{color:"var(--text-muted)"}},"Not found")
          :filtered.map(function(c){var s=c.name===props.value;return React.createElement("button",{key:c.isoCode,type:"button",
            onClick:function(){props.onChange(c.name);setOpen(false);setSrch("")},
            className:"w-full px-2.5 py-1.5 flex items-center gap-2 text-left text-[12px] transition",
            style:{backgroundColor:s?"rgba(16,185,129,0.08)":"transparent",color:s?"#34d399":"var(--text-primary)",borderRadius:"6px"}
          },React.createElement("span",{className:"text-sm leading-none"},flag(c.isoCode)),React.createElement("span",{className:"truncate flex-1"},c.name),s?React.createElement(Ico,{d:D.check,className:"w-3 h-3"}):null)})
      )
    ):null
  );
}


/* ================================================================
   MAIN COMPONENT
   ================================================================ */
export default function BrandDetailPage() {
  // ✅ 2. SOCKET HOOK CALL KIYA (Real-time updates ke liye)
  useBrandSocketSync();

  var router=useRouter(), pathname=usePathname(), params=useParams();
  var brandId=params.id, qc=useQueryClient();
  var backPath=pathname.substring(0,pathname.lastIndexOf("/"))||"/admin/brands";

  var t=useState("info"),tab=t[0],setTab=t[1];
  var e=useState(false),showEdit=e[0],setShowEdit=e[1];
  var dl=useState(false),showDel=dl[0],setShowDel=dl[1];
  var fm=useState({brand_code:"",name:"",description:"",country:"",is_active:true}),form=fm[0],setForm=fm[1];
  var lf=useState(null),logoFile=lf[0],setLogoFile=lf[1];
  var lp=useState(""),logoPrev=lp[0],setLogoPrev=lp[1];

  var allC=useMemo(function(){return Country.getAllCountries().map(function(c){return{name:c.name,isoCode:c.isoCode}})},[]);
  var q=useQuery({queryKey:["brands"],queryFn:brandApi.getAll});
  var brands=q.data||[], loading=q.isLoading;
  var brand=brands.find(function(b){return b._id===brandId});

  var uMut=useMutation({mutationFn:function(r){return brandApi.update(r.id,r.data)},onSuccess:function(){qc.invalidateQueries({queryKey:["brands"]});setLogoFile(null);setLogoPrev("");setShowEdit(false)}});
  var dMut=useMutation({mutationFn:function(){return brandApi.delete(brandId)},onSuccess:function(){qc.invalidateQueries({queryKey:["brands"]});router.push(backPath)}});

  var cs={backgroundColor:"var(--bg-card)",borderRadius:"12px"};
  var is_={backgroundColor:"var(--bg-tertiary)",border:"1px solid var(--border-color)",color:"var(--text-primary)",borderRadius:"8px"};

  function doEdit(){if(!brand)return;setForm({brand_code:brand.brand_code||"",name:brand.name||"",description:brand.description||"",country:brand.country||"",is_active:brand.is_active!==undefined?brand.is_active:true});setLogoPrev(lurl(brand));setLogoFile(null);setShowEdit(true)}
  
  function doSubmit(ev){
    ev.preventDefault();
    var fd=new FormData();
    // ✅ FIX: Brand Code ko update waqt send nahi kar rahe, ya agar send bhi karein to backend ignore karega.
    // Lekin safety ke liye hum form.brand_code bhej rahe hain, par input field locked hai.
    fd.append("brand_code", form.brand_code); 
    fd.append("name", form.name);
    fd.append("description", form.description||"");
    fd.append("country", form.country||"");
    fd.append("is_active", form.is_active.toString());
    if(logoFile) fd.append("logo", logoFile);
    uMut.mutate({id:brandId, data:fd});
  }

  function onFile(ev){var fi=ev.target.files&&ev.target.files[0];if(fi){if(fi.size>10485760)return;setLogoFile(fi);setLogoPrev(URL.createObjectURL(fi))}}

  var submitting=uMut.isPending, deleting=dMut.isPending;
  var logoSrc=brand?lurl(brand):"";
  var hasLogo=!!(brand&&brand.logo&&brand.logo.img_url);
  var wasUp=!!(brand&&brand.created_at&&brand.updated_at&&brand.created_at!==brand.updated_at);

  // ✅ FIXED: Use brand.products array from API
  var totalProducts = (brand && brand.products && Array.isArray(brand.products)) ? brand.products.length : 0;
  
  // ✅ FIXED: Calculate active products using status field
  var activeProducts = (brand && brand.products && Array.isArray(brand.products)) 
    ? brand.products.filter(function(p){ return p.status === "active"; }).length 
    : 0;
  
  // ✅ FIXED: Calculate unique categories using category_id._id
  var uniqueCategories = (brand && brand.products && Array.isArray(brand.products))
    ? new Set(brand.products.map(function(p){ return p.category_id?._id || p.category_id; }).filter(Boolean)).size
    : 0;

  if(loading){return React.createElement("div",{className:"w-full flex items-center justify-center py-24",style:{color:"var(--text-primary)"}},React.createElement("div",{className:"rounded-xl py-14 px-20 flex items-center gap-2",style:cs},Spin("w-4 h-4"),React.createElement("span",{className:"text-[13px]",style:{color:"var(--text-muted)"}},"Loading...")))}

  if(!brand){return React.createElement("div",{className:"w-full flex items-center justify-center py-24",style:{color:"var(--text-primary)"}},React.createElement("div",{className:"rounded-xl py-14 px-8 flex flex-col items-center gap-3 text-center",style:cs},React.createElement("p",{className:"text-base font-semibold"},"Brand Not Found"),React.createElement("p",{className:"text-[12px]",style:{color:"var(--text-muted)"}},"This brand does not exist."),React.createElement(SBtn,{primary:true,onClick:function(){router.push(backPath)}},"Back to Brands")))}

  var tabList = [
    { id:"info",     label:"Brand Info" },
    { id:"products", label:"Products", badge: totalProducts > 0 ? String(totalProducts) : null },
    { id:"activity", label:"Activity", badge: wasUp?"2":"1" }
  ];

  return React.createElement("div",{className:"w-full",style:{color:"var(--text-primary)"}},
    React.createElement("div",{className:"w-full space-y-4"},

      /* ================================================================
         HEADER
         ================================================================ */
      React.createElement("div",{className:"px-1"},

        /* Row 1: Breadcrumb */
        React.createElement("div",{className:"flex items-center gap-1.5 mb-3"},
          React.createElement("button",{onClick:function(){router.push(backPath)},
            className:"text-[12px] font-medium transition hover:opacity-70",
            style:{color:"var(--text-muted)",background:"none",border:"none",cursor:"pointer",padding:0}
          },"Brands"),
          React.createElement(Ico,{d:D.chevron,className:"w-3 h-3",sw:1.5}),
          React.createElement("span",{className:"text-[12px] font-medium",style:{color:"var(--text-primary)"}},brand.name)
        ),

        /* Row 2: Logo + Name + Description + Actions */
        React.createElement("div",{className:"flex items-start gap-4"},

          /* Logo */
          React.createElement("div",{className:"w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center",style:{backgroundColor:"var(--bg-card)", border: "1px solid var(--border-color)"}},
            hasLogo?React.createElement("img",{src:logoSrc,alt:brand.name,className:"w-full h-full object-contain p-1"})
              :React.createElement("span",{className:"text-xl font-bold",style:{color:"#34d399"}},ini(brand.name))
          ),

          /* Name + Description + Meta */
          React.createElement("div",{className:"flex-1 min-w-0 pt-0.5"},
            React.createElement("div",{className:"flex items-center gap-2 mb-0.5"},
              React.createElement("h1",{className:"text-[18px] font-semibold truncate leading-tight"},brand.name),
              React.createElement(StatusPill,{active:brand.is_active})
            ),
            brand.description?React.createElement("p",{className:"text-[12px] truncate mb-1.5",style:{color:"var(--text-muted)"}},brand.description):null,
            React.createElement("div",{className:"flex items-center gap-2 flex-wrap"},
              React.createElement("span",{className:"text-[11px] font-mono px-2 py-0.5 rounded-md",style:{backgroundColor:"var(--bg-tertiary)",color:"var(--text-muted)"}},brand.brand_code||"—"),
              brand.country?React.createElement("span",{className:"text-[11px] px-2 py-0.5 rounded-md",style:{backgroundColor:"var(--bg-tertiary)",color:"var(--text-muted)"}},brand.country):null,
              React.createElement("span",{className:"text-[11px]",style:{color:"var(--text-muted)"}},"Created "+fd(brand.created_at)),
              wasUp?React.createElement("span",{className:"text-[11px]",style:{color:"var(--text-muted)"}},"· Updated "+tago(brand.updated_at)):null
            )
          ),

          /* Action buttons */
          React.createElement("div",{className:"flex items-center gap-1 shrink-0 pt-1"},
            React.createElement(SBtn,{onClick:doEdit},React.createElement(Ico,{d:D.edit,className:"w-3.5 h-3.5"}),"Edit"),
            React.createElement(SBtn,{danger:true,onClick:function(){setShowDel(true)},disabled:deleting},React.createElement(Ico,{d:D.trash,className:"w-3.5 h-3.5"}),"Delete")
          )

        )
      ),

      /* ================================================================
         TABS + CONTENT CARD
         ================================================================ */
      React.createElement("div",{className:"rounded-xl overflow-hidden",style:cs},

        /* ---- TAB BAR ---- */
        React.createElement("div",{className:"px-5 flex items-center gap-5",style:{borderBottom:"1px solid var(--border-color)"}},
          tabList.map(function(tb){
            var active = tab===tb.id;
            return React.createElement("button",{key:tb.id,type:"button",onClick:function(){setTab(tb.id)},
              className:"flex items-center gap-1.5 text-[12px] font-medium transition-colors duration-150",
              style:{
                background:"none", border:"none", cursor:"pointer",
                padding:"10px 0 9px 0",
                color: active?"#34d399":"var(--text-muted)",
                borderBottom: active?"2px solid #34d399":"2px solid transparent",
                marginBottom:"-1px"
              }
            },
              tb.label,
              tb.badge?React.createElement("span",{className:"text-[9px] px-1.5 py-0.5 rounded-full font-bold leading-none",
                style:{backgroundColor: active?"rgba(16,185,129,0.15)":"var(--bg-tertiary)", color: active?"#34d399":"var(--text-muted)"}
              },tb.badge):null
            );
          })
        ),

        /* ---- TAB CONTENT ---- */
        React.createElement("div",{className:"p-5"},

          /* =============================================
             TAB 1: BRAND INFO
             ============================================= */
          tab==="info"?React.createElement("div",{className:"grid grid-cols-1 lg:grid-cols-3 gap-4"},

            React.createElement(InnerCard,null,
              React.createElement(SecTitle,null,"Details"),
              React.createElement("div",{className:"divide-y",style:{borderColor:"var(--border-color)"}},
                React.createElement(InfoRow,{label:"Code",value:brand.brand_code,mono:true}),
                React.createElement(InfoRow,{label:"Name",value:brand.name}),
                React.createElement(InfoRow,{label:"Country",value:brand.country||"—"}),
                React.createElement(InfoRow,{label:"Status",value:brand.is_active?"Active":"Inactive",green:brand.is_active}),
                React.createElement(InfoRow,{label:"Created",value:fdt(brand.created_at)}),
                React.createElement(InfoRow,{label:"Updated",value:wasUp?fdt(brand.updated_at):"Never"})
              )
            ),

            React.createElement(InnerCard,null,
              React.createElement(SecTitle,null,"Description"),
              React.createElement("p",{className:"text-[12px] leading-relaxed whitespace-pre-wrap break-words",style:{color:"var(--text-secondary)"}},
                brand.description||"No description provided."
              )
            ),

            React.createElement(InnerCard,null,
              React.createElement(SecTitle,null,"Logo"),
              hasLogo?React.createElement("div",{className:"space-y-3"},
                React.createElement("div",{className:"flex items-center gap-2.5"},
                  React.createElement("div",{className:"w-10 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center",style:{border:"1px solid var(--border-color)",borderRadius:"8px"}},
                    React.createElement("img",{src:logoSrc,alt:"",className:"w-full h-full object-contain p-0.5"})),
                  React.createElement("div",{className:"min-w-0"},
                    React.createElement("p",{className:"text-[11px] font-medium truncate",style:{color:"var(--text-primary)"}},brand.logo.img_url?brand.logo.img_url.split("/").pop():""),
                    React.createElement("a",{href:logoSrc,target:"_blank",rel:"noopener noreferrer",className:"inline-flex items-center gap-0.5 text-[10px] mt-0.5 hover:opacity-80",style:{color:"#34d399"}},"View full ",React.createElement(Ico,{d:D.link,className:"w-2.5 h-2.5"}))
                  )
                ),
                React.createElement("div",{className:"rounded-lg p-3 divide-y",style:{border:"1px solid var(--border-color)",borderRadius:"8px"}},
                  React.createElement(InfoRow,{label:"Size",value:fsz(brand.logo.img_size),mono:true}),
                  React.createElement(InfoRow,{label:"Type",value:brand.logo.mimeType,mono:true}),
                  React.createElement(InfoRow,{label:"Dimensions",value:brand.logo.width&&brand.logo.height?brand.logo.width+"x"+brand.logo.height+"px":"—",mono:true})
                )
              ):React.createElement("div",{className:"flex flex-col items-center justify-center py-6 gap-2"},
                React.createElement("div",{className:"w-12 h-12 rounded-xl flex items-center justify-center",style:{border:"1px dashed var(--border-color)"}},
                  React.createElement(Ico,{d:D.image,className:"w-5 h-5",sw:1.5})
                ),
                React.createElement("span",{className:"text-[11px]",style:{color:"var(--text-muted)"}},"No logo uploaded")
              )
            )

          ):null,

          /* =============================================
             TAB 2: PRODUCTS (✅ FULLY FIXED)
             ============================================= */
          tab==="products"?React.createElement("div",{className:"space-y-4"},

            // Stats Cards
            React.createElement("div",{className:"grid grid-cols-2 lg:grid-cols-4 gap-3"},
              React.createElement(InnerCard,null,
                React.createElement("div",{className:"flex items-center gap-2 mb-1"},
                  React.createElement(Ico,{d:D.box,className:"w-3.5 h-3.5",sw:1.5}),
                  React.createElement("span",{className:"text-[10px] font-medium uppercase tracking-wide",style:{color:"var(--text-muted)"}},"Total Products")
                ),
                React.createElement("p",{className:"text-[20px] font-semibold"},String(totalProducts))
              ),
              React.createElement(InnerCard,null,
                React.createElement("div",{className:"flex items-center gap-2 mb-1"},
                  React.createElement(Ico,{d:D.check,className:"w-3.5 h-3.5",sw:1.5}),
                  React.createElement("span",{className:"text-[10px] font-medium uppercase tracking-wide",style:{color:"var(--text-muted)"}},"Active")
                ),
                React.createElement("p",{className:"text-[20px] font-semibold",style:{color:"#34d399"}},String(activeProducts))
              ),
              React.createElement(InnerCard,null,
                React.createElement("div",{className:"flex items-center gap-2 mb-1"},
                  React.createElement(Ico,{d:D.layers,className:"w-3.5 h-3.5",sw:1.5}),
                  React.createElement("span",{className:"text-[10px] font-medium uppercase tracking-wide",style:{color:"var(--text-muted)"}},"Categories")
                ),
                React.createElement("p",{className:"text-[20px] font-semibold"},String(uniqueCategories))
              ),
              React.createElement(InnerCard,null,
                React.createElement("div",{className:"flex items-center gap-2 mb-1"},
                  React.createElement(Ico,{d:D.cube,className:"w-3.5 h-3.5",sw:1.5}),
                  React.createElement("span",{className:"text-[10px] font-medium uppercase tracking-wide",style:{color:"var(--text-muted)"}},"Brand Status")
                ),
                React.createElement("p",{className:"text-[20px] font-semibold",style:{color: brand.is_active ? "#34d399" : "#f87171"}},
                  brand.is_active?"Active":"Inactive"
                )
              )
            ),

            // Products Table
            React.createElement(InnerCard,null,
              React.createElement(SecTitle,null,"Products Under This Brand"),
              brand.products && brand.products.length > 0
                ? React.createElement("div",{className:"overflow-x-auto"},
                    React.createElement("table",{className:"w-full text-[12px]",style:{borderCollapse:"collapse"}},
                      React.createElement("thead",null,
                        React.createElement("tr",{style:{borderBottom:"1px solid var(--border-color)"}},
                          React.createElement("th",{className:"text-left py-2 px-2 font-medium",style:{color:"var(--text-muted)"}},"Product Name"),
                          React.createElement("th",{className:"text-left py-2 px-2 font-medium",style:{color:"var(--text-muted)"}},"Category"),
                          React.createElement("th",{className:"text-left py-2 px-2 font-medium",style:{color:"var(--text-muted)"}},"Created"),
                          React.createElement("th",{className:"text-center py-2 px-2 font-medium",style:{color:"var(--text-muted)"}},"Status"),
                          React.createElement("th",{className:"text-center py-2 px-2 font-medium",style:{color:"var(--text-muted)"}},"Action")
                        )
                      ),
                      React.createElement("tbody",null,
                        brand.products.map(function(p,i){
                          var isActive = p.status === "active";
                          return React.createElement("tr",{key:p._id||i,style:{borderBottom:"1px solid var(--border-color)"}},
                            React.createElement("td",{className:"py-2.5 px-2 font-medium",style:{color:"var(--text-primary)"}},p.name||"—"),
                            React.createElement("td",{className:"py-2.5 px-2",style:{color:"var(--text-secondary)"}},
                              p.category_id?.name || p.category_id || "—"
                            ),
                            React.createElement("td",{className:"py-2.5 px-2",style:{color:"var(--text-muted)"}},
                              p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"
                            ),
                            React.createElement("td",{className:"py-2.5 px-2 text-center"},
                              React.createElement("span",{className:"inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                                style:{
                                  backgroundColor: isActive ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                                  color: isActive ? "#34d399" : "#f87171"
                                }
                              }, isActive ? "Active" : "Inactive")
                            ),
                            React.createElement("td",{className:"py-2.5 px-2 text-center"},
                              React.createElement("button", {
                                type: "button",
                                onClick: function() { router.push("/admin/products/" + p._id); },
                                className: "inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition hover:opacity-80",
                                style: { backgroundColor: "var(--bg-tertiary)", color: "var(--accent)", border: "1px solid var(--border-color)" }
                              }, React.createElement(Ico, {d: D.eye, className: "w-3 h-3"}), "View")
                            )
                          );
                        })
                      )
                    )
                  )
                : React.createElement("div",{className:"flex flex-col items-center justify-center py-8 gap-2"},
                    React.createElement("div",{className:"w-12 h-12 rounded-xl flex items-center justify-center",style:{border:"1px dashed var(--border-color)"}},
                      React.createElement(Ico,{d:D.box,className:"w-5 h-5",sw:1.5})
                    ),
                    React.createElement("p",{className:"text-[12px] font-medium",style:{color:"var(--text-secondary)"}},"No products yet"),
                    React.createElement("p",{className:"text-[11px]",style:{color:"var(--text-muted)"}},"Products assigned to this brand will appear here.")
                  )
            )

          ):null,

          /* =============================================
             TAB 3: ACTIVITY
             ============================================= */
          tab==="activity"?React.createElement("div",{className:"grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4"},

            React.createElement(InnerCard,null,
              React.createElement(SecTitle,null,"Timeline"),
              React.createElement(TItem,{icon:React.createElement(Ico,{d:D.plus,className:"w-3.5 h-3.5",sw:1.5}),title:"Brand Created",sub:"Added to the system",user:brand.createdby,date:brand.created_at,color:"#34d399",last:!wasUp}),
              wasUp?React.createElement(TItem,{icon:React.createElement(Ico,{d:D.pencil,className:"w-3.5 h-3.5",sw:1.5}),title:"Brand Updated",sub:"Details were modified",user:brand.updatedby,date:brand.updated_at,color:"#60a5fa",last:true}):null,
              !wasUp?React.createElement("div",{className:"mt-3 px-3 py-2.5 rounded-lg flex items-center gap-2",style:{border:"1px dashed var(--border-color)",borderRadius:"8px"}},
                React.createElement(Ico,{d:D.clock,className:"w-3.5 h-3.5 shrink-0",sw:1.5}),
                React.createElement("span",{className:"text-[11px]",style:{color:"var(--text-muted)"}},"No updates yet. Changes will appear here.")
              ):null
            ),

            React.createElement(InnerCard,null,
              React.createElement(SecTitle,null,"People"),
              React.createElement("div",{className:"divide-y",style:{borderColor:"var(--border-color)"}},
                React.createElement(Person,{user:brand.createdby,label:"Created By",date:brand.created_at,color:"#34d399",fallback:"Unknown user"}),
                wasUp&&brand.updatedby?React.createElement(Person,{user:brand.updatedby,label:"Updated By",date:brand.updated_at,color:"#60a5fa"})
                  :React.createElement(Person,{user:null,label:"Updated By",color:"#60a5fa",fallback:"No updates yet"})
              )
            )

          ):null

        )

      ),

    ),

    /* ===== EDIT MODAL ===== */
    showEdit?React.createElement("div",{className:"fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"},
      React.createElement("div",{className:"w-full max-w-md rounded-xl overflow-hidden",style:Object.assign({},cs,{border:"1px solid var(--border-color)"})},
        React.createElement("div",{className:"px-4 py-3 flex items-center justify-between",style:{borderBottom:"1px solid var(--border-color)"}},
          React.createElement("span",{className:"text-[13px] font-medium"},"Edit Brand"),
          React.createElement("button",{onClick:function(){setShowEdit(false)},className:"p-0.5 rounded hover:opacity-70",style:{color:"var(--text-muted)",background:"none",border:"none",cursor:"pointer"}},React.createElement(Ico,{d:D.close,className:"w-3.5 h-3.5"}))
        ),
        React.createElement("form",{onSubmit:doSubmit,className:"p-4 space-y-3 max-h-[70vh] overflow-y-auto"},
          React.createElement("div",{className:"grid grid-cols-2 gap-2.5"},
            
            // ✅ FIXED: Brand Code Input - Disabled & Read Only
            React.createElement("div",null,
              React.createElement("label",{className:"block text-[11px] mb-1",style:{color:"var(--text-muted)"}},"Code (Locked)"),
              React.createElement("input",{
                type:"text",
                value:form.brand_code,
                readOnly: true, // ✅ Cannot type
                disabled: true, // ✅ Visually disabled
                className:"h-8 px-2.5 rounded-lg text-[12px] w-full outline-none opacity-60 cursor-not-allowed",
                style: Object.assign({}, is_, { backgroundColor: "rgba(0,0,0,0.2)" }) // Darker background
              })
            ),

            React.createElement("div",null,React.createElement("label",{className:"block text-[11px] mb-1",style:{color:"var(--text-muted)"}},"Name *"),React.createElement("input",{type:"text",value:form.name,onChange:function(ev){setForm(Object.assign({},form,{name:ev.target.value}))},required:true,disabled:submitting,className:"h-8 px-2.5 rounded-lg text-[12px] w-full outline-none disabled:opacity-40",style:is_}))
          ),
          React.createElement("div",null,React.createElement("label",{className:"block text-[11px] mb-1",style:{color:"var(--text-muted)"}},"Description"),React.createElement("textarea",{value:form.description,onChange:function(ev){setForm(Object.assign({},form,{description:ev.target.value}))},rows:2,disabled:submitting,className:"px-2.5 py-2 rounded-lg text-[12px] w-full outline-none disabled:opacity-40 resize-none",style:is_})),
          React.createElement("div",null,React.createElement("label",{className:"block text-[11px] mb-1",style:{color:"var(--text-muted)"}},"Logo"),
            React.createElement("div",{className:"flex items-center gap-2.5"},
              React.createElement("div",{className:"w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0",style:{backgroundColor:"var(--bg-tertiary)",border:"1px dashed var(--border-color)"}},logoPrev?React.createElement("img",{src:logoPrev,alt:"",className:"w-full h-full object-cover"}):React.createElement(Ico,{d:D.image,className:"w-4 h-4"})),
              React.createElement("div",{className:"flex items-center gap-2"},
                React.createElement("label",{htmlFor:"lup",className:"cursor-pointer h-7 px-2.5 rounded-lg text-[11px] inline-flex items-center gap-1",style:{backgroundColor:"var(--bg-tertiary)",border:"1px solid var(--border-color)",color:"var(--text-primary)",borderRadius:"8px"}},React.createElement(Ico,{d:D.upload,className:"w-3 h-3"}),logoPrev?"Change":"Upload"),
                logoPrev?React.createElement("button",{type:"button",onClick:function(){setLogoFile(null);setLogoPrev("")},className:"text-[10px] text-red-500 hover:underline",style:{background:"none",border:"none",cursor:"pointer"}},"Remove"):null,
                React.createElement("input",{id:"lup",type:"file",accept:"image/png,image/jpeg,image/webp",className:"hidden",onChange:onFile,disabled:submitting})
              )
            )
          ),
          React.createElement("div",{className:"grid grid-cols-2 gap-2.5 items-end"},
            React.createElement("div",null,React.createElement("label",{className:"block text-[11px] mb-1",style:{color:"var(--text-muted)"}},"Country"),React.createElement(CDD,{value:form.country,onChange:function(v){setForm(Object.assign({},form,{country:v}))},disabled:submitting,allCountries:allC})),
            React.createElement("label",{className:"flex items-center gap-1.5 h-8 cursor-pointer"},React.createElement("input",{type:"checkbox",checked:form.is_active,onChange:function(ev){setForm(Object.assign({},form,{is_active:ev.target.checked}))},disabled:submitting,className:"w-3.5 h-3.5 rounded disabled:opacity-40",style:{accentColor:"var(--accent)"}}),React.createElement("span",{className:"text-[12px]",style:{color:"var(--text-muted)"}},"Active"))
          ),
          React.createElement("div",{className:"flex gap-2 pt-2.5",style:{borderTop:"1px solid var(--border-color)"}},
            React.createElement(SBtn,{onClick:function(){setShowEdit(false)},disabled:submitting},"Cancel"),
            React.createElement("button",{type:"submit",disabled:submitting,className:"flex-1 h-8 rounded-lg text-[12px] font-medium transition disabled:opacity-40 hover:opacity-85",style:{backgroundColor:"var(--accent)",color:"var(--accent-text)",border:"none",cursor:"pointer",borderRadius:"8px"}},submitting?"Saving...":"Update")
          )
        )
      )
    ):null,

    /* ===== DELETE MODAL ===== */
    showDel?React.createElement("div",{className:"fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"},
      React.createElement("style",null,"@keyframes mi{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}"),
      React.createElement("div",{className:"w-full max-w-xs rounded-xl p-4",style:Object.assign({},cs,{border:"1px solid var(--border-color)",animation:"mi .15s ease-out"})},
        React.createElement("div",{className:"flex items-start gap-2.5"},
          React.createElement("div",{className:"w-8 h-8 rounded-full flex items-center justify-center shrink-0",style:{backgroundColor:"rgba(239,68,68,0.08)"}},React.createElement(Ico,{d:D.warn,className:"w-4 h-4",sw:1.5})),
          React.createElement("div",null,
            React.createElement("p",{className:"text-[13px] font-medium"},"Delete "+brand.name+"?"),
            React.createElement("p",{className:"text-[11px] mt-0.5",style:{color:"var(--text-muted)"}},"This cannot be undone.")
          )
        ),
        React.createElement("div",{className:"flex gap-2 mt-3.5"},
          React.createElement(SBtn,{onClick:function(){setShowDel(false)},disabled:deleting},"Cancel"),
          React.createElement("button",{onClick:function(){dMut.mutate()},disabled:deleting,className:"flex-1 h-8 rounded-lg text-[12px] font-medium text-white transition disabled:opacity-40 hover:opacity-85 flex items-center justify-center gap-1",style:{backgroundColor:"var(--danger)",border:"none",cursor:"pointer",borderRadius:"8px"}},deleting?React.createElement(React.Fragment,null,Spin("w-3 h-3"),"Deleting..."):"Delete")
        )
      )
    ):null

  );
}