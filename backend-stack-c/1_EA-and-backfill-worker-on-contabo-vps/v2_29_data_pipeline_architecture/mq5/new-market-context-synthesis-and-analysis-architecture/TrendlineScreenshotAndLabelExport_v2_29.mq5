//+------------------------------------------------------------------+
//|                    TrendlineScreenshotAndLabelExport_v2_29.mq5   |
//|   Periodic, labelled screenshots of the hand-drawn Trendline_TLn |
//|   lines on whatever chart this is attached to -- a single source |
//|   chart, or the combined destination chart Objects Copier_6Sou-  |
//|   rces_1Dest_v2_29.mq5 builds from up to 6 source timeframes.    |
//|   Capture is gated by the shared curation-session flag in        |
//|   TrendlineLabelUtils.mqh, so a half-finished edit is never       |
//|   published -- the last good screenshot is served until a new    |
//|   one is captured. See TRENDLINE-CONTEXT-BLUEPRINT.md in this    |
//|   folder for the full data contract this file implements.        |
//|                                        Copyright 2026            |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026"
#property version   "1.00"
#property description "Periodic Labelled Chart Screenshot + Label Export (Trendline family) - Stack C Data Pipeline v2.29"
#property indicator_chart_window
#property indicator_plots 0

#include "TrendlineLabelUtils.mqh"

//--- Input parameters
input group "===== Line Scanning ====="
input string   InpTrendLinePrefix     = "Trendline";          // Base text for trend line names (<prefix>_TL1..TLn)
input int      InpMaxTrendlines       = 12;                   // Highest TL slot number to scan for

input group "===== Capture Settings ====="
input int      InpCaptureEveryMinutes = 15;                   // Capture interval, aligned to the UTC/broker clock
input int      InpScreenshotWidth     = 1920;                 // Screenshot width (pixels)
input int      InpScreenshotHeight    = 1080;                 // Screenshot height (pixels)
input string   InpBaseFileName        = "TrendlineScreenshot"; // Export filename prefix

input group "===== On-Chart Captions (baked into the screenshot) ====="
input bool     InpShowLegend          = true;                 // Draw an auto-generated legend box (bottom-left)
input bool     InpShowInlineTags      = true;                 // Draw a short "TLn" tag at each line's right-hand end
input int      InpLegendMaxLabelChars = 44;                   // Characters of a line's label shown per legend row

input group "===== Source Timeframe Mapping (only needed on a COMBINED chart) ====="
input string   InpSourcePrefix_A = "A_"; input string InpSourceLabel_A = ""; // e.g. M5  -- leave label "" if unused
input string   InpSourcePrefix_B = "B_"; input string InpSourceLabel_B = ""; // e.g. M15
input string   InpSourcePrefix_C = "C_"; input string InpSourceLabel_C = ""; // e.g. M30
input string   InpSourcePrefix_D = "D_"; input string InpSourceLabel_D = ""; // e.g. H1
input string   InpSourcePrefix_E = "E_"; input string InpSourceLabel_E = ""; // e.g. H4
input string   InpSourcePrefix_F = "F_"; input string InpSourceLabel_F = ""; // e.g. M3 (built from fractals; "Constellation" is its alias name)

input group "===== Session Overview (Layer-1 policy, read only at Publish) ====="
input bool     InpShowOverviewBox     = true;                 // Draw an editable "session overview" box on chart

input group "===== Debug ====="
input bool     InpDebugMode           = true;                 // Print extra diagnostic messages

//--- This indicator's own UI object names (never re-scanned as a trend line)
#define BTN_START       "TLSX_StartCurationBtn"
#define BTN_PUBLISH     "TLSX_PublishBtn"
#define MARKER_NAME     "TLSX_PresenceMarker"
#define LEGEND_PFX      "TLSX_Legend_"
#define TAG_PFX         "TLSX_Tag_"
#define OVERVIEW_LABEL  "TLSX_OverviewLabel"
#define OVERVIEW_BOX    "TLSX_OverviewBox"

#define SOURCE_MAP_COUNT 6

//--- One detected line, collected fresh on every capture
struct DetectedLine
{
   int      slot;              // TL number WITHIN its own source timeframe only (NOT globally unique)
   string   slotKey;            // "M15:TL3" -- stable identity across redraws; see the Blueprint §4.1
   string   sourceTimeframe;    // M3 | M5 | M15 | M30 | H1 | H4 | this chart's own _Period ("M3" is the Constellation source)
   string   name;
   string   label;
   double   value;
   color    clr;
   datetime anchor1Time;
   double   anchor1Price;
   datetime anchor2Time;
   double   anchor2Price;
   bool     rayExtends;
};

//--- State
long     g_chart_id              = 0;
datetime g_last_capture_boundary = 0;     // last UTC-aligned boundary this instance captured at
bool     g_curation_was_active   = false; // edge-detect, so the pause/resume line prints once, not every 5s
string   g_session_overview      = "";    // frozen at Publish time only -- see OnChartEvent's BTN_PUBLISH branch

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
{
   g_chart_id = ChartID();

   int maxTl = InpMaxTrendlines;
   if(maxTl < 1)  maxTl = 1;
   if(maxTl > 99) maxTl = 99;

   CreateMarker();
   CreateButtons();
   CreateOverviewBox();

   if(!EventSetTimer(5))
   {
      Print("ERROR: Failed to create 5-second timer");
      return INIT_FAILED;
   }

   g_curation_was_active = TLU_IsCurationActive();
   PrintFormat("TrendlineScreenshotAndLabelExport_v2_29 initialised on %s %s. Capture every %d min (curation flag: %s).",
               _Symbol, EnumToString(_Period), MathMax(InpCaptureEveryMinutes, 1),
               g_curation_was_active ? "ACTIVE - capture paused" : "clear - capture running");

   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Custom indicator deinitialization function                       |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   ObjectDelete(0, BTN_START);
   ObjectDelete(0, BTN_PUBLISH);
   ObjectDelete(0, MARKER_NAME);
   ObjectDelete(0, OVERVIEW_LABEL);
   ObjectDelete(0, OVERVIEW_BOX);
   ClearLegendAndTags();
   Print("TrendlineScreenshotAndLabelExport_v2_29 stopping (reason: ", reason, ")");
}

//+------------------------------------------------------------------+
//| Custom indicator iteration function -- nothing to compute here;  |
//| every action is timer-driven (see OnTimer)                       |
//+------------------------------------------------------------------+
int OnCalculate(const int rates_total,
                const int prev_calculated,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
                const long &tick_volume[],
                const long &volume[],
                const int &spread[])
{
   return rates_total;
}

//+------------------------------------------------------------------+
//| Timer event handler                                               |
//+------------------------------------------------------------------+
void OnTimer()
{
   bool active = TLU_IsCurationActive();
   if(active != g_curation_was_active)
   {
      Print(active
            ? "Curation session ACTIVE - auto-capture paused on this chart (serving the last screenshot)."
            : "Curation session cleared - auto-capture resumed on this chart.");
      g_curation_was_active = active;
      UpdateButtonVisibility();
   }

   if(active)
      return; // the last good file stays exactly as it was -- nothing half-finished is ever published

   datetime srv  = TimeTradeServer();
   datetime utc  = TLU_ServerToUtc(srv);
   int      step = MathMax(InpCaptureEveryMinutes, 1) * 60;
   datetime boundary = (datetime)((long)((long)utc / step) * step);

   if(boundary != g_last_capture_boundary)
   {
      g_last_capture_boundary = boundary;
      DoCapture(boundary);
   }
}

//+------------------------------------------------------------------+
//| Chart event handler                                               |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
{
   if(id != CHARTEVENT_OBJECT_CLICK)
      return;

   if(sparam == BTN_START)
   {
      ObjectSetInteger(0, BTN_START, OBJPROP_STATE, false);
      GlobalVariableSet(TLU_GV_CURATION_ACTIVE, 1.0);
      g_curation_was_active = true;
      UpdateButtonVisibility();
      Print("=== CURATION SESSION STARTED -- auto-capture paused on every chart that shares this flag ===");
   }
   else if(sparam == BTN_PUBLISH)
   {
      ObjectSetInteger(0, BTN_PUBLISH, OBJPROP_STATE, false);
      GlobalVariableSet(TLU_GV_CURATION_ACTIVE, 0.0);
      datetime nowUtc = TLU_ServerToUtc(TimeTradeServer());
      GlobalVariableSet(TLU_GV_PUBLISHED_AT, (double)nowUtc);

      // Freeze the overview text now -- Layer-1 policy content changes only at
      // Publish, never re-read from the live box on a later periodic capture
      // (the box may be mid-edit toward the NEXT session by then).
      g_session_overview = TLU_TsvSafe(ObjectGetString(0, OVERVIEW_BOX, OBJPROP_TEXT));

      g_curation_was_active = false;
      UpdateButtonVisibility();
      PrintFormat("=== CURATION SESSION PUBLISHED at %s UTC -- capturing now ===",
                  TimeToString(nowUtc, TIME_DATE | TIME_MINUTES));

      g_last_capture_boundary = nowUtc; // this capture stands for the current boundary too
      DoCapture(nowUtc);
   }
}

//+------------------------------------------------------------------+
//| Scan the chart for <prefix>_TL1..TLn lines, sorted by slot        |
//+------------------------------------------------------------------+
int ScanLines(DetectedLine &out[])
{
   ArrayResize(out, 0);
   int      total = ObjectsTotal(0, -1, OBJ_TREND);
   datetime now   = TimeCurrent();

   string prefixes[SOURCE_MAP_COUNT] = {InpSourcePrefix_A, InpSourcePrefix_B, InpSourcePrefix_C,
                                         InpSourcePrefix_D, InpSourcePrefix_E, InpSourcePrefix_F};
   string labels[SOURCE_MAP_COUNT]   = {InpSourceLabel_A, InpSourceLabel_B, InpSourceLabel_C,
                                         InpSourceLabel_D, InpSourceLabel_E, InpSourceLabel_F};

   for(int i = 0; i < total; i++)
   {
      string name = ObjectName(0, i, -1, OBJ_TREND);

      // On a combined chart the name may carry a known source prefix (e.g. "B_");
      // strip it before slot-parsing and use its mapped label as the source
      // timeframe. On a plain single-source chart (no label configured) this
      // never matches, and behaviour is exactly as it was before.
      string srcLabel, scanName;
      bool matched = TLU_StripKnownPrefix(name, prefixes, labels, SOURCE_MAP_COUNT, srcLabel, scanName);
      string tf = matched ? srcLabel : EnumToString(_Period);

      int slot = TLU_ParseSlotFromName(scanName, InpTrendLinePrefix, InpMaxTrendlines);
      if(slot < 1)
         continue;

      int idx = ArraySize(out);
      ArrayResize(out, idx + 1);
      out[idx].slot            = slot;
      out[idx].sourceTimeframe = tf;
      out[idx].slotKey         = tf + ":TL" + IntegerToString(slot);
      out[idx].name            = name;
      out[idx].label           = TLU_GetLineLabel(0, name);
      out[idx].value           = TLU_GetTrendLineValueAt(0, name, now);
      out[idx].clr             = (color)ObjectGetInteger(0, name, OBJPROP_COLOR);
      out[idx].anchor1Time     = (datetime)ObjectGetInteger(0, name, OBJPROP_TIME, 0);
      out[idx].anchor1Price    = ObjectGetDouble(0, name, OBJPROP_PRICE, 0);
      out[idx].anchor2Time     = (datetime)ObjectGetInteger(0, name, OBJPROP_TIME, 1);
      out[idx].anchor2Price    = ObjectGetDouble(0, name, OBJPROP_PRICE, 1);
      out[idx].rayExtends      = (bool)ObjectGetInteger(0, name, OBJPROP_RAY_RIGHT);
   }

   // Small array (<= InpMaxTrendlines): a selection sort by slot is plenty.
   int n = ArraySize(out);
   for(int a = 0; a < n - 1; a++)
   {
      int best = a;
      for(int b = a + 1; b < n; b++)
         if(out[b].slot < out[best].slot)
            best = b;
      if(best != a)
      {
         DetectedLine tmp = out[a];
         out[a]    = out[best];
         out[best] = tmp;
      }
   }

   return n;
}

//+------------------------------------------------------------------+
//| Capture one screenshot: rebuild captions, shoot, write the        |
//| sidecar stamp                                                     |
//+------------------------------------------------------------------+
void DoCapture(const datetime boundaryUtc)
{
   DetectedLine lines[];
   int n = ScanLines(lines);

   RebuildCaptions(lines, n);

   string stamp = TimeToString(boundaryUtc, TIME_DATE | TIME_MINUTES);
   StringReplace(stamp, ".", "");
   StringReplace(stamp, ":", "");
   StringReplace(stamp, " ", "_");

   string pngName = StringFormat("%s_%s_%s_%s.png",
                                 InpBaseFileName, _Symbol, EnumToString(_Period), stamp);

   bool ok = ChartScreenShot(0, pngName, InpScreenshotWidth, InpScreenshotHeight);
   if(!ok)
   {
      PrintFormat("ERROR: ChartScreenShot failed for %s (error %d)", pngName, GetLastError());
      return;
   }

   WriteSidecar(pngName, boundaryUtc, lines, n);

   if(InpDebugMode)
      PrintFormat("Captured %s with %d line(s) at %s UTC", pngName, n, stamp);
}

//+------------------------------------------------------------------+
//| Write a small TSV sidecar next to the PNG: capture time, the     |
//| session's last-published time, and one row per detected line --  |
//| enough for a future uploader to stamp the R2 object metadata     |
//| (mirroring mtf_render's own ChartStamp) without duplicating the   |
//| full per-bar value export that TrendlineValueExport_v2_29.mq5     |
//| owns.                                                              |
//+------------------------------------------------------------------+
void WriteSidecar(const string pngName, const datetime boundaryUtc,
                  const DetectedLine &lines[], const int n)
{
   string sidecarName = pngName + ".tsv";
   int fh = FileOpen(sidecarName, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if(fh == INVALID_HANDLE)
   {
      PrintFormat("ERROR: Cannot open sidecar file for writing: %s (error %d)", sidecarName, GetLastError());
      return;
   }

   FileWriteString(fh, "image\t" + pngName + "\r\n");
   FileWriteString(fh, "symbol\t" + _Symbol + "\r\n");
   FileWriteString(fh, "timeframe\t" + EnumToString(_Period) + "\r\n");
   FileWriteString(fh, "captured_at_utc\t" + IntegerToString((long)boundaryUtc) + "\r\n");

   datetime pub = TLU_LastPublishedAt();
   FileWriteString(fh, "session_published_at_utc\t" + (pub > 0 ? IntegerToString((long)pub) : "") + "\r\n");
   FileWriteString(fh, "session_overview\t" + TLU_TsvSafe(g_session_overview) + "\r\n");
   FileWriteString(fh, "line_count\t" + IntegerToString(n) + "\r\n");
   FileWriteString(fh, "slot\tslot_key\tsource_timeframe\tname\tvalue\tanchor1_time\tanchor1_price\tanchor2_time\tanchor2_price\tray_extends\tlabel\r\n");

   for(int i = 0; i < n; i++)
   {
      string valueStr  = (lines[i].value != EMPTY_VALUE) ? DoubleToString(lines[i].value, _Digits) : "";
      string safeName  = TLU_TsvSafe(lines[i].name);
      string safeLabel = TLU_TsvSafe(lines[i].label);
      string safeTf    = TLU_TsvSafe(lines[i].sourceTimeframe);
      string safeKey   = TLU_TsvSafe(lines[i].slotKey);
      string a1t       = IntegerToString((long)lines[i].anchor1Time);
      string a2t       = IntegerToString((long)lines[i].anchor2Time);
      FileWriteString(fh, StringFormat("%d\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\r\n",
                                       lines[i].slot,
                                       safeKey,
                                       safeTf,
                                       safeName,
                                       valueStr,
                                       a1t,
                                       DoubleToString(lines[i].anchor1Price, _Digits),
                                       a2t,
                                       DoubleToString(lines[i].anchor2Price, _Digits),
                                       lines[i].rayExtends ? "1" : "0",
                                       safeLabel));
   }

   FileClose(fh);
}

//+------------------------------------------------------------------+
//| Build the legend box and the inline per-line tags from whatever   |
//| lines are on the chart right now -- always in step with the       |
//| actual drawing, never hand-typed                                  |
//+------------------------------------------------------------------+
void RebuildCaptions(const DetectedLine &lines[], const int n)
{
   ClearLegendAndTags();

   if(InpShowLegend)
   {
      string hdrName = LEGEND_PFX + "Header";
      string hdrText = StringFormat("%s %s trendlines (%d)", _Symbol, EnumToString(_Period), n);
      CreateLegendLabel(hdrName, 0, hdrText, clrSilver);

      for(int i = 0; i < n; i++)
      {
         string rowName  = LEGEND_PFX + IntegerToString(i + 1);
         string lbl      = lines[i].label;
         if(StringLen(lbl) > InpLegendMaxLabelChars)
            lbl = StringSubstr(lbl, 0, InpLegendMaxLabelChars) + "...";
         string valueStr = (lines[i].value != EMPTY_VALUE) ? DoubleToString(lines[i].value, _Digits) : "n/a";
         string rowText  = StringFormat("%s  %s  %s", lines[i].slotKey, valueStr, lbl);
         CreateLegendLabel(rowName, i + 1, rowText, lines[i].clr);
      }
   }

   if(InpShowInlineTags)
   {
      for(int i = 0; i < n; i++)
      {
         string   tagName = TAG_PFX + IntegerToString(lines[i].slot);
         datetime t2      = (datetime)ObjectGetInteger(0, lines[i].name, OBJPROP_TIME, 1);
         double   p2      = ObjectGetDouble(0, lines[i].name, OBJPROP_PRICE, 1);

         if(ObjectCreate(0, tagName, OBJ_TEXT, 0, t2, p2))
         {
            ObjectSetString(0, tagName, OBJPROP_TEXT, "TL" + IntegerToString(lines[i].slot));
            ObjectSetString(0, tagName, OBJPROP_FONT, "Segoe UI Bold");
            ObjectSetInteger(0, tagName, OBJPROP_FONTSIZE, 9);
            ObjectSetInteger(0, tagName, OBJPROP_COLOR, lines[i].clr);
            ObjectSetInteger(0, tagName, OBJPROP_SELECTABLE, false);
            ObjectSetInteger(0, tagName, OBJPROP_HIDDEN, true);
         }
      }
   }

   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| One legend row, bottom-left corner, stacked upward                |
//+------------------------------------------------------------------+
void CreateLegendLabel(const string name, const int row, const string text, const color clr)
{
   if(ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0))
   {
      ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_LOWER);
      ObjectSetInteger(0, name, OBJPROP_XDISTANCE, 10);
      ObjectSetInteger(0, name, OBJPROP_YDISTANCE, 20 + row * 16);
      ObjectSetString(0, name, OBJPROP_TEXT, text);
      ObjectSetString(0, name, OBJPROP_FONT, "Consolas");
      ObjectSetInteger(0, name, OBJPROP_FONTSIZE, 9);
      ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
   }
}

//+------------------------------------------------------------------+
//| Remove every legend row and inline tag this indicator owns        |
//+------------------------------------------------------------------+
void ClearLegendAndTags()
{
   for(int i = ObjectsTotal(0, -1, OBJ_LABEL) - 1; i >= 0; i--)
   {
      string n = ObjectName(0, i, -1, OBJ_LABEL);
      if(StringFind(n, LEGEND_PFX) == 0)
         ObjectDelete(0, n);
   }
   for(int i = ObjectsTotal(0, -1, OBJ_TEXT) - 1; i >= 0; i--)
   {
      string n = ObjectName(0, i, -1, OBJ_TEXT);
      if(StringFind(n, TAG_PFX) == 0)
         ObjectDelete(0, n);
   }
}

//+------------------------------------------------------------------+
//| Create the Start Curation / Publish buttons                       |
//+------------------------------------------------------------------+
void CreateButtons()
{
   ObjectDelete(0, BTN_START);
   ObjectDelete(0, BTN_PUBLISH);

   if(ObjectCreate(0, BTN_START, OBJ_BUTTON, 0, 0, 0))
   {
      ObjectSetInteger(0, BTN_START, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, BTN_START, OBJPROP_XDISTANCE, 10);
      ObjectSetInteger(0, BTN_START, OBJPROP_YDISTANCE, 25);
      ObjectSetInteger(0, BTN_START, OBJPROP_XSIZE, 170);
      ObjectSetInteger(0, BTN_START, OBJPROP_YSIZE, 28);
      ObjectSetString(0, BTN_START, OBJPROP_TEXT, "Start Curation Session");
      ObjectSetString(0, BTN_START, OBJPROP_FONT, "Segoe UI Bold");
      ObjectSetInteger(0, BTN_START, OBJPROP_FONTSIZE, 8);
      ObjectSetInteger(0, BTN_START, OBJPROP_COLOR, clrWhite);
      ObjectSetInteger(0, BTN_START, OBJPROP_BORDER_COLOR, clrSilver);
      ObjectSetInteger(0, BTN_START, OBJPROP_HIDDEN, true);
      ObjectSetInteger(0, BTN_START, OBJPROP_STATE, false);
   }

   if(ObjectCreate(0, BTN_PUBLISH, OBJ_BUTTON, 0, 0, 0))
   {
      ObjectSetInteger(0, BTN_PUBLISH, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, BTN_PUBLISH, OBJPROP_XDISTANCE, 190);
      ObjectSetInteger(0, BTN_PUBLISH, OBJPROP_YDISTANCE, 25);
      ObjectSetInteger(0, BTN_PUBLISH, OBJPROP_XSIZE, 150);
      ObjectSetInteger(0, BTN_PUBLISH, OBJPROP_YSIZE, 28);
      ObjectSetString(0, BTN_PUBLISH, OBJPROP_TEXT, "Publish / Lock");
      ObjectSetString(0, BTN_PUBLISH, OBJPROP_FONT, "Segoe UI Bold");
      ObjectSetInteger(0, BTN_PUBLISH, OBJPROP_FONTSIZE, 8);
      ObjectSetInteger(0, BTN_PUBLISH, OBJPROP_COLOR, clrWhite);
      ObjectSetInteger(0, BTN_PUBLISH, OBJPROP_BORDER_COLOR, clrSilver);
      ObjectSetInteger(0, BTN_PUBLISH, OBJPROP_HIDDEN, true);
      ObjectSetInteger(0, BTN_PUBLISH, OBJPROP_STATE, false);
   }

   UpdateButtonVisibility();
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Colour the two buttons to show which state is current             |
//+------------------------------------------------------------------+
void UpdateButtonVisibility()
{
   bool active = TLU_IsCurationActive();
   ObjectSetInteger(0, BTN_START,   OBJPROP_BGCOLOR, active ? clrGray      : clrDarkOrange);
   ObjectSetInteger(0, BTN_PUBLISH, OBJPROP_BGCOLOR, active ? clrDarkGreen : clrGray);
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| An editable on-chart box for the session overview (Layer-1        |
//| policy, Blueprint §2/§3): one free sentence covering the WHOLE    |
//| chart, not any one line -- e.g. "Range-bound between the M30 and  |
//| H1 bands; H4 still downtrend". Read and frozen only when Publish  |
//| is clicked (see OnChartEvent); never read by the periodic timer.  |
//+------------------------------------------------------------------+
void CreateOverviewBox()
{
   ObjectDelete(0, OVERVIEW_LABEL);
   ObjectDelete(0, OVERVIEW_BOX);
   if(!InpShowOverviewBox)
      return;

   if(ObjectCreate(0, OVERVIEW_LABEL, OBJ_LABEL, 0, 0, 0))
   {
      ObjectSetInteger(0, OVERVIEW_LABEL, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, OVERVIEW_LABEL, OBJPROP_XDISTANCE, 10);
      ObjectSetInteger(0, OVERVIEW_LABEL, OBJPROP_YDISTANCE, 58);
      ObjectSetString(0, OVERVIEW_LABEL, OBJPROP_TEXT, "Session overview (read at Publish):");
      ObjectSetString(0, OVERVIEW_LABEL, OBJPROP_FONT, "Segoe UI");
      ObjectSetInteger(0, OVERVIEW_LABEL, OBJPROP_FONTSIZE, 8);
      ObjectSetInteger(0, OVERVIEW_LABEL, OBJPROP_COLOR, clrSilver);
      ObjectSetInteger(0, OVERVIEW_LABEL, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, OVERVIEW_LABEL, OBJPROP_HIDDEN, true);
   }

   if(ObjectCreate(0, OVERVIEW_BOX, OBJ_EDIT, 0, 0, 0))
   {
      ObjectSetInteger(0, OVERVIEW_BOX, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, OVERVIEW_BOX, OBJPROP_XDISTANCE, 10);
      ObjectSetInteger(0, OVERVIEW_BOX, OBJPROP_YDISTANCE, 74);
      ObjectSetInteger(0, OVERVIEW_BOX, OBJPROP_XSIZE, 560);
      ObjectSetInteger(0, OVERVIEW_BOX, OBJPROP_YSIZE, 22);
      ObjectSetString(0, OVERVIEW_BOX, OBJPROP_FONT, "Segoe UI");
      ObjectSetInteger(0, OVERVIEW_BOX, OBJPROP_FONTSIZE, 9);
      ObjectSetInteger(0, OVERVIEW_BOX, OBJPROP_COLOR, clrWhite);
      ObjectSetInteger(0, OVERVIEW_BOX, OBJPROP_BGCOLOR, clrBlack);
      ObjectSetInteger(0, OVERVIEW_BOX, OBJPROP_ALIGN, ALIGN_LEFT);
      ObjectSetInteger(0, OVERVIEW_BOX, OBJPROP_SELECTABLE, true);
      ObjectSetInteger(0, OVERVIEW_BOX, OBJPROP_HIDDEN, true);
      ObjectSetString(0, OVERVIEW_BOX, OBJPROP_TEXT, g_session_overview);
   }
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Hidden marker so another tool can detect this indicator is        |
//| running on the chart (same pattern as the other tools in this    |
//| folder's presence markers)                                        |
//+------------------------------------------------------------------+
void CreateMarker()
{
   ObjectDelete(0, MARKER_NAME);
   if(ObjectCreate(0, MARKER_NAME, OBJ_LABEL, 0, 0, 0))
   {
      ObjectSetInteger(0, MARKER_NAME, OBJPROP_XDISTANCE, -100);
      ObjectSetInteger(0, MARKER_NAME, OBJPROP_YDISTANCE, -100);
      ObjectSetInteger(0, MARKER_NAME, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetString(0, MARKER_NAME, OBJPROP_TEXT, "TrendlineScreenshotAndLabelExport_v2_29 Marker");
      ObjectSetInteger(0, MARKER_NAME, OBJPROP_COLOR, clrNONE);
      ObjectSetInteger(0, MARKER_NAME, OBJPROP_HIDDEN, true);
      ObjectSetInteger(0, MARKER_NAME, OBJPROP_SELECTABLE, false);
   }
}
//+------------------------------------------------------------------+
