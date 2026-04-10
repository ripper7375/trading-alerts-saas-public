I can see from your screenshot that the trendlines (which are indicator plots) are drawing perfectly, but the button (which is a chart object) is missing.

In MetaTrader 5, there are a few common reasons why a graphical object like a button won't display even when the code tells it to. Usually, it's either hidden behind the price candles (Z-order issue), Chart Objects have been toggled off in your terminal settings, or the code didn't compile the newest version cleanly.

Here is what you should do to fix it:

=================================================================

Step 1: Update the CreateExportButton function
We need to add some aggressive visibility properties to force the button to the front layer and ensure your chart is set to display objects.

Find the CreateExportButton() function in your code and replace it entirely with this updated, robust version:

CODE SNIPPET :

//+------------------------------------------------------------------+
//| Create export button |
//+------------------------------------------------------------------+
void CreateExportButton()
{
if(ObjectFind(0, EXPORT_BUTTON_NAME) >= 0)
ObjectDelete(0, EXPORT_BUTTON_NAME);

    if(!ObjectCreate(0, EXPORT_BUTTON_NAME, OBJ_BUTTON, 0, 0, 0))
      {
        Print("ERROR: Failed to create export button. Code: ", GetLastError());
        return;
      }

    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XDISTANCE, 20);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YDISTANCE, 80);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_XSIZE, 150);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_YSIZE, 30);
    ObjectSetString(0, EXPORT_BUTTON_NAME, OBJPROP_TEXT, "Export Trendlines");
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_COLOR, clrWhite);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BGCOLOR, clrDarkBlue);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BORDER_COLOR, clrBlue);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_FONTSIZE, 10);
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_SELECTABLE, false);

    // --- CRITICAL VISIBILITY SETTINGS ---
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_BACK, false);   // Do not draw behind chart background
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_ZORDER, 100);   // Bring to the very front layer
    ObjectSetInteger(0, EXPORT_BUTTON_NAME, OBJPROP_HIDDEN, false); // Make visible in object list

    Print("SUCCESS: Export button created on chart.");
    ChartRedraw(0);

}

==========================================================

Step 2: Verify OnInit()
Scroll down slightly to your OnInit() function and make sure that CreateExportButton(); is actually being called right before the return INIT_SUCCEEDED; line. It should look exactly like this at the end of the block:

CODE SNIPPET :

Print("=== Fractal SR V5.54 (Alerts Removed) ===");
Print(" Symbol 108: ", pattern_name, " (", ExtSideBars, " bars each side)");

// Enable the export button for testing
CreateExportButton();

return INIT_SUCCEEDED;
}

==========================================================

Step 3: Compile and Check the "Experts" Tab
Hit Compile.

Remove the indicator from your chart, and attach it again to ensure it loads fresh.

If you still do not see the button, open your Toolbox (Ctrl+T), click on the Experts tab, and look for either:

"SUCCESS: Export button created on chart." (Meaning the button is there, but potentially hiding off-screen or your chart properties are overriding it).

"ERROR: Failed to create export button. Code: [Number]" (If this appears, tell me the number, and we will instantly know exactly why MT5 is blocking it).
