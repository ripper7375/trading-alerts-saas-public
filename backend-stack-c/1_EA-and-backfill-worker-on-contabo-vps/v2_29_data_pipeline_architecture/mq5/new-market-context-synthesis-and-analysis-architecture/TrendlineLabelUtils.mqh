//+------------------------------------------------------------------+
//|                                        TrendlineLabelUtils.mqh   |
//|        Shared helpers for hand-drawn, labelled trendline tools   |
//|                                        Copyright 2026            |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026"
#property strict

//+------------------------------------------------------------------+
//| Shared GlobalVariable names for the curation-session flag. Every |
//| tool that reads or writes the "a human is mid-curation" state    |
//| must use these exact strings so a flag set from one chart (or    |
//| one tool) is seen by every other chart/tool -- the session spans |
//| several timeframes, not one chart.                                |
//+------------------------------------------------------------------+
#define TLU_GV_CURATION_ACTIVE   "TL_Curation_InProgress"
#define TLU_GV_PUBLISHED_AT      "TL_Curation_PublishedAt"

//+------------------------------------------------------------------+
//| Make a string safe to sit inside one TSV cell. A tab, CR or LF    |
//| that the text itself carries -- typed, or pasted from elsewhere,  |
//| or set programmatically by something other than the Object       |
//| Properties dialog -- is turned into a single space, so it can     |
//| never add a phantom column or cut a row short. Apply this to      |
//| every free-text field (a line's label, its object name) right     |
//| before it is written into a TSV row.                              |
//+------------------------------------------------------------------+
string TLU_TsvSafe(const string text)
{
   string out = text;
   StringReplace(out, "\t", " ");
   StringReplace(out, "\r\n", " ");
   StringReplace(out, "\r", " ");
   StringReplace(out, "\n", " ");
   return out;
}

//+------------------------------------------------------------------+
//| Slot number (1..maxSlots) carried by an object name.              |
//|                                                                    |
//| Reads the WHOLE run of digits right after "<prefix>_TL", so       |
//| "Trendline_TL10" is slot 10 and never slot 1. This is the fix     |
//| ported from TrendlineValueExport_v2_29.mq5 (it used to ask, per   |
//| "does the name CONTAIN <prefix>_TL<k>?" and stop at the first     |
//| match -- so "Trendline_TL10" matched the "_TL1" check first and   |
//| was read as slot 1). Every tool should call this one copy rather  |
//| than re-implementing the scan, so the fix never has to be redone. |
//|                                                                    |
//| Returns 0 when the name carries no valid slot key (TL0, a slot     |
//| above maxSlots, or no key at all). Case-sensitive; text before or  |
//| after the key is allowed ("My_Trendline_TL3_old" is still slot 3). |
//+------------------------------------------------------------------+
int TLU_ParseSlotFromName(const string name, const string prefix, const int maxSlots)
{
   const string key  = prefix + "_TL";
   const int    klen = StringLen(key);
   const int    len  = StringLen(name);

   int pos = StringFind(name, key, 0);
   while(pos >= 0)
   {
      int i      = pos + klen;
      int digits = 0;
      int slot   = 0;

      // Take the whole digit run ("TL10" is ten, not "TL1" then "0").
      while(i < len && digits <= 3)
      {
         ushort ch = StringGetCharacter(name, i);
         if(ch < '0' || ch > '9')
            break;
         slot = slot * 10 + (int)(ch - '0');
         digits++;
         i++;
      }

      if(digits >= 1 && digits <= 3 && slot >= 1 && slot <= maxSlots)
         return slot;

      // Not a valid key at this occurrence; a later one may still match.
      pos = StringFind(name, key, pos + 1);
   }

   return 0;
}

//+------------------------------------------------------------------+
//| Match a known source prefix at the START of a (possibly multi-    |
//| source-combined) object name, and report which source it came    |
//| from. `prefixes`/`labels` are parallel arrays -- the same         |
//| convention Objects Copier_5/6Sources_1Dest_v2_29.mq5 itself uses  |
//| ("A_".."F_" by default) -- so a caller passes exactly what it     |
//| configured those tools with.                                      |
//|                                                                    |
//| A slot whose `labels[i]` is "" is SKIPPED (not matched), so by    |
//| default -- nothing configured -- this always returns false and    |
//| every line falls back to the caller's own chart period; only once |
//| a label is filled in does that slot's prefix become active. This  |
//| keeps a single-chart (not combined) exporter's behaviour exactly  |
//| as it was before this function existed.                           |
//|                                                                    |
//| Returns true and fills outLabel/outRemainder on a match; false    |
//| (outLabel = "", outRemainder = name) otherwise.                   |
//+------------------------------------------------------------------+
bool TLU_StripKnownPrefix(const string name, const string &prefixes[], const string &labels[],
                          const int count, string &outLabel, string &outRemainder)
{
   for(int i = 0; i < count; i++)
   {
      if(labels[i] == "" || prefixes[i] == "")
         continue;

      int plen = StringLen(prefixes[i]);
      if(StringLen(name) > plen && StringSubstr(name, 0, plen) == prefixes[i])
      {
         outLabel     = labels[i];
         outRemainder = StringSubstr(name, plen);
         return true;
      }
   }

   outLabel     = "";
   outRemainder = name;
   return false;
}

//+------------------------------------------------------------------+
//| Broker server time -> UTC, offset rounded to the nearest hour --  |
//| the same formula already used by TrendlineValueExport_v2_29.mq5   |
//| the Stack C exporters (export_collector_validator_v2.py §7.1), so |
//| every tool's timestamps agree with one another.                   |
//+------------------------------------------------------------------+
datetime TLU_ServerToUtc(const datetime serverTime)
{
   long srvOff         = (long)TimeTradeServer() - (long)TimeGMT();
   long offsetRounded  = (long)MathRound(srvOff / 3600.0) * 3600;
   return (datetime)((long)serverTime - offsetRounded);
}

//+------------------------------------------------------------------+
//| Current (or at-a-given-time) value of a trend line: the native    |
//| lookup first, then the same slope interpolation/extrapolation     |
//| fallback as TrendlineValueExport_v2_29.mq5's GetTrendLinePriceAtTime, |
//| so every tool reads a line's price the same way. EMPTY_VALUE when |
//| the line cannot be read (deleted, or not enough anchors).         |
//+------------------------------------------------------------------+
double TLU_GetTrendLineValueAt(const long chartId, const string name, const datetime atTime)
{
   if(ObjectFind(chartId, name) < 0)
      return EMPTY_VALUE;

   double val = ObjectGetValueByTime(chartId, name, atTime);
   if(val != EMPTY_VALUE && MathIsValidNumber(val) && val > 0)
      return val;

   datetime t1 = (datetime)ObjectGetInteger(chartId, name, OBJPROP_TIME, 0);
   double   p1 = ObjectGetDouble(chartId, name, OBJPROP_PRICE, 0);
   datetime t2 = (datetime)ObjectGetInteger(chartId, name, OBJPROP_TIME, 1);
   double   p2 = ObjectGetDouble(chartId, name, OBJPROP_PRICE, 1);

   if(t1 == 0 || t2 == 0 || t1 == t2 || !MathIsValidNumber(p1) || !MathIsValidNumber(p2))
      return EMPTY_VALUE;

   double slope = (p2 - p1) / (double)(t2 - t1);
   double calc  = p1 + slope * (double)(atTime - t1);
   return (MathIsValidNumber(calc) && calc > 0) ? calc : EMPTY_VALUE;
}

//+------------------------------------------------------------------+
//| The structured label a human set on a line: its own Text          |
//| (Description) field first, its Tooltip field as a fallback, ""   |
//| when neither is set.                                              |
//|                                                                    |
//| This is deliberately the ONE place the label lives -- not a       |
//| separate caption object. Written once on the trend line itself,   |
//| it travels through an object-copy step for free (the 5-sources-   |
//| to-1-destination tool already copies OBJPROP_TEXT and             |
//| OBJPROP_TOOLTIP unconditionally for every object type it handles, |
//| trend lines included), and it can never drift out of step with   |
//| the line the way a hand-typed Text-tool caption near it could.    |
//+------------------------------------------------------------------+
string TLU_GetLineLabel(const long chartId, const string name)
{
   string text = ObjectGetString(chartId, name, OBJPROP_TEXT);
   if(text != "")
      return text;
   return ObjectGetString(chartId, name, OBJPROP_TOOLTIP);
}

//+------------------------------------------------------------------+
//| Is a curation session (trace / combine / filter) in progress      |
//| right now? While it is, an auto-exporter should skip capturing    |
//| and keep serving whatever it already has -- the same "the last    |
//| good image is kept" rule mtf_render_upload_worker.py already      |
//| documents for the cycle-rendered charts.                           |
//+------------------------------------------------------------------+
bool TLU_IsCurationActive()
{
   if(!GlobalVariableCheck(TLU_GV_CURATION_ACTIVE))
      return false;
   return GlobalVariableGet(TLU_GV_CURATION_ACTIVE) > 0.5;
}

//+------------------------------------------------------------------+
//| When the session was last published/locked, UTC (0 = never).      |
//+------------------------------------------------------------------+
datetime TLU_LastPublishedAt()
{
   if(!GlobalVariableCheck(TLU_GV_PUBLISHED_AT))
      return 0;
   return (datetime)GlobalVariableGet(TLU_GV_PUBLISHED_AT);
}
//+------------------------------------------------------------------+
