//+------------------------------------------------------------------+
//|                              Symbol Information.mq5_ V10         |
//|                                   Copyright 2024                 |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024"
#property version   "1.00"
#property indicator_chart_window
#property indicator_buffers 57   // Updated to include all ROE buffers
#property indicator_plots   1   // At least one plot

input group "Table Header Configuration"
input string HeaderText = "Symbol Information :";  // Header text
input int HeaderHeight = 25;                      // Height of header
input color HeaderColor = clrNONE;               // Header background color
input color HeaderTextColor = clrBlack;           // Header text color
input color SeparatorColor = clrBlack;            // Separator line color

input group "Table Body Configuration"
input int FirstColumnWidth = 350;        // Width of first column (for labels)
input int SecondColumnWidth = 150;       // Width of second column (values)
input int LabelX = 10;                   // X position for labels
input int ValueX = 300;                  // X position for values
input int StartY = 20;                   // Starting Y position
input int YStep = 25;                    // Vertical spacing between lines
input color TextColor = clrBlack;        // Text color for labels
input color BgColor = clrNONE;           // Background color
input int FontSize = 8;                  // Font size

input group "Symbol Level Thresholds"
input double ROI_SL_Threshold = -1.00;    // Symbol SL Monitoring (%) (Enter Negative Value)
input double ROI_TP_Threshold = 1.00;    // Symbol TP Monitoring (%) (Enter Positive Value)
input double Weight_Deviation_Percent = 30.0;    // Weight class deviation threshold for Symbol (%) (Enter Positive Value)
input double Leverage_Upper = 25.0;       // Symbol Leverage upper threshold (%) (Enter Positive Value)
input double Leverage_Lower = 15.0;       // Symbol Leverage lower threshold (%) (Enter Positive Value)

input group "Portfolio Level Thresholds"
input double Portfolio_ROE_SL_Threshold = -3.00; // Portfolio SL Threshold (%) (Enter Negative Value)
input double Portfolio_ROE_TP_Threshold = 3.00;  // Portfolio TP Threshold (%) (Enter Positive Value)
input double Portfolio_ROI_SL_Threshold = -1.00; // Portfolio SL Monitoring (%) (Enter Negative Value)
input double Portfolio_ROI_TP_Threshold = 1.00;  // Portfolio TP Monitoring (%) (Enter Positive Value)

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
input double Portfolio_Leverage_Upper = 2.50;    // Portfolio Leverage upper threshold (x) (Enter Positive Value)
input double Portfolio_Leverage_Lower = 1.00;    // Portfolio Leverage lower threshold (x) (Enter Positive Value)

input group "Risk Assessment Parameters"
input double HighRiskThreshold = 7.50;      // High Risk threshold (Enter Positive Value)
input double MediumHighThreshold = 5.00;    // Medium High threshold (Enter Positive Value)
input double MediumLowThreshold = 2.50;     // Medium Low threshold (Enter Positive Value)

//--- Add new input group after existing ones
input group "Risk-Reward Ratio Settings"
input double FirstRiskRewardRatio = 1.5;  // First Risk-Reward ratio (Enter Positive Value)
input double SecondRiskRewardRatio = 2.0; // Second Risk-Reward ratio (Enter Positive Value)
input double ThirdRiskRewardRatio = 2.5;  // Third Risk-Reward ratio (Enter Positive Value)
input bool EnableSecondRR = true;         // Enable Second Risk-Reward ratio
input bool EnableThirdRR = true;          // Enable Third Risk-Reward ratio

//+------------------------------------------------------------------+
//|  Allowed symbols array                                           |
//+------------------------------------------------------------------+
string g_AllowedSymbols[] =
  {
// Forex Pairs (single entry per pair)
   "AUDCAD.i", "AUDCHF.i", "AUDJPY.i", "AUDNZD.i", "AUDUSD.i",
   "CADCHF.i", "CADJPY.i", "CHFJPY.i",
   "EURAUD.i", "EURCAD.i", "EURCHF.i", "EURGBP.i", "EURJPY.i", "EURNZD.i", "EURUSD.i",
   "GBPAUD.i", "GBPCAD.i", "GBPCHF.i", "GBPJPY.i", "GBPNZD.i", "GBPUSD.i",
   "NZDCAD.i", "NZDCHF.i", "NZDJPY.i", "NZDUSD.i",
   "USDCAD.i", "USDCHF.i", "USDJPY.i",
// Non-forex symbols
   "BTCUSD", "ETHUSD", "XAGUSD", "XAUUSD", "USOUSD"
  };

//+------------------------------------------------------------------+
//|  Symbol validation function                                      |
//+------------------------------------------------------------------+
bool IsAllowedSymbol(const string symbol)
  {
// Try exact match first
   for(int i = 0; i < ArraySize(g_AllowedSymbols); i++)
     {
      if(symbol == g_AllowedSymbols[i])
         return true;
     }

// Check with/without .i suffix
   string symbolNoSuffix = (StringSubstr(symbol, StringLen(symbol) - 2) == ".i") ?
                           StringSubstr(symbol, 0, StringLen(symbol) - 2) :
                           symbol + ".i";

   for(int i = 0; i < ArraySize(g_AllowedSymbols); i++)
     {
      if(symbolNoSuffix == g_AllowedSymbols[i])
         return true;
     }

   return false;
  }

// Global variables and arrays
string g_LabelNames[] =
  {
   "Symbol", "Net Position", "Net Lot Size", "#Open", "#Pending",
   "Net Exposure", "Directional Weight", "Weight Class",
   "Leverage Contribution", "P/L - net Swap", "ROE Contribution"
  };

//+------------------------------------------------------------------+
//| Data Structures                                                  |
//+------------------------------------------------------------------+

// Structure for raw position data (Step 1)
struct RawPositionData
  {
   ulong             ticket;                    // Position/Order ticket
   string            symbol;                   // Complete symbol name
   double            volume;                   // Position volume
   ENUM_POSITION_TYPE positionType; // Buy/Sell
   double            profit;                   // Current profit
   double            swap;                     // Current swap
   bool              isOpen;                     // True for open positions, false for pending orders
  };

// Structure for first split data (Steps 2-11 + ROE)
struct FirstSplitData
  {
   // Existing fields remain unchanged
   string            symbol;
   double            buyVolume;
   double            sellVolume;
   double            netVolume;
   double            absoluteNetVolume;
   double            netExposure;
   double            weight;
   double            directionalWeight;
   string            netPosition;
   int               pendingBuyCount;
   int               pendingSellCount;
   double            roi;
   string            tpSlCautionRoi;
   string            tpSlCautionRoe;
   int               weightRank;
   string            leverageCaution;

   // Add ROE-related fields
   double            primaryLevelSL;
   double            extendedLevelSL;
   double            firstLevelTP;
   double            secondLevelTP;
   double            thirdLevelTP;
  };

// Structure for second split data (Step 12 + ROE)
struct SecondSplitData
  {
   // Existing fields remain unchanged
   string            symbol;
   double            totalProfit;
   double            totalSwap;
   double            netProfitSwap;

   // Add ROE-related fields
   double            positiveNetProfitSwap;
   double            negativeNetProfitSwap;
   double            allocateProportion;
   double            lossCushionRatio;
   string            slNotification;
   string            tpNotification;
  };

// Structure for third split data (Step 13)
struct ThirdSplitData
  {
   string            symbol;                     // Complete symbol name
   int               openPositions;              // Count of open positions
   int               pendingOrders;              // Count of pending orders
   int               pendingBuyCount;            // Add this
   int               pendingSellCount;           // Add this
  };

// Add new structure for risk assessment results
struct RiskAssessmentResults
  {
   double            weightedScoreX;         // Weighted score for leverage contribution
   double            weightedScoreY;         // Weighted score for symbol count
   double            weightedScoreZ;         // Weighted score for leverage std dev
   double            totalScore;             // Total weighted score (ZZ)
   string            riskLevel;              // Overall risk level
   string            leverageNotification;   // Notification for leverage
   string            symbolsNotification;    // Notification for symbol count
   string            weightNotification;     // Notification for weight balance
  };

// Global arrays for storing data
RawPositionData g_RawPositions[];      // Array for raw position data
FirstSplitData g_FirstSplitData[];     // Array for first split calculations
SecondSplitData g_SecondSplitData[];   // Array for second split calculations
ThirdSplitData g_ThirdSplitData[];     // Array for third split calculations

// Global variables for calculations
double g_TotalExposure = 0;            // Total portfolio exposure
string g_AccountCurrency = "";         // Account currency
int g_ValueX = 0;                      // Actual X position for values
string g_weightClass;                  // Based on weight calculation

// Global variable for risk assessment
RiskAssessmentResults g_RiskAssessment;

//--- Flat buffers for external access (Symbol Level)
double buffer_AbsoluteNetVolume[];    // From FirstSplitData
double buffer_NetPosition[];          // From FirstSplitData (converted to 1.0/-1.0)
double buffer_OpenPositions[];        // From ThirdSplitData
double buffer_PendingOrders[];        // From ThirdSplitData
double buffer_NetProfitSwap[];        // From SecondSplitData
double buffer_TotalSwap[];            // From SecondSplitData
double buffer_ROI[];                  // From FirstSplitData
double buffer_NetExposure[];          // From FirstSplitData
double buffer_Weight[];               // From FirstSplitData
double buffer_DirectionalWeight[];    // From FirstSplitData
double buffer_WeightRank[];           // From FirstSplitData
double buffer_ROEContribution[];      // Derived calculation
double buffer_LeverageContribution[]; // Derived calculation
double buffer_PendingBuyCount[];      // From ThirdSplitData
double buffer_PendingSellCount[];     // From ThirdSplitData
double buffer_TotalProfit[];          // From SecondSplitData
double buffer_TPSLCautionROI[];       // Transformation 1->5
double buffer_ROE_SL_Status[];        // For SL notifications (-2 = SL at Loss, -1 = SL at Reduced Profit, 0 = No SL)
double buffer_ROE_TP_Status[];        // For TP notifications (1 = First TP, 2 = Second TP, 3 = Third TP, 0 = No TP)
double buffer_LeverageCaution[];      // Transformation 11->15
double buffer_WeightClass[];          // For weight class conversion (1.0=Over, -1.0=Under, 0.0=Balanced)
double buffer_SymbolTotalExposure[];  // Calculation at symbol level

//--- Additional ROE Data Buffers
double buffer_PositiveNetProfitSwap[]; // From SecondSplitData ROE calculations
double buffer_NegativeNetProfitSwap[]; // From SecondSplitData ROE calculations
double buffer_AllocationProportion[];  // From SecondSplitData ROE calculations
double buffer_LossCushionRatio[];      // From SecondSplitData ROE calculations
double buffer_PrimaryLevelSL[];        // From FirstSplitData ROE calculations
double buffer_ExtendedLevelSL[];       // From FirstSplitData ROE calculations
double buffer_FirstLevelTP[];          // From FirstSplitData ROE calculations
double buffer_SecondLevelTP[];         // From FirstSplitData ROE calculations
double buffer_ThirdLevelTP[];          // From FirstSplitData ROE calculations

// Add portfolio level buffers
double buffer_Portfolio_AbsoluteNetVolume;    // Sum of absoluteNetVolume across symbols
double buffer_Portfolio_OpenPositions;         // Sum of openPositions across symbols
double buffer_Portfolio_PendingOrders;         // Sum of pendingOrders across symbols
double buffer_Portfolio_PendingBuyCount;       // Sum of pendingBuyCount across symbols
double buffer_Portfolio_PendingSellCount;      // Sum of pendingSellCount across symbols
double buffer_Portfolio_NetProfitSwap;         // Sum of netProfitSwap across symbols
double buffer_Portfolio_TotalSwap;             // Sum of totalSwap across symbols
double buffer_Portfolio_TotalProfit;           // Sum of totalProfit across symbols
double buffer_Portfolio_TotalExposure;         // Sum of symbolTotalExposure across symbols
double buffer_Portfolio_NetExposure;           // Sum of netExposure across symbols
double buffer_Portfolio_DirectionalWeight;     // Sum of directionalWeight across symbols
double buffer_Portfolio_Weight;                // Not Available for Calculation at Portfolio Level
double buffer_Portfolio_NetPosition;           // Based on sum-product calculation
double buffer_Portfolio_LeverageContribution;  // Portfolio exposure / account equity
double buffer_Portfolio_ROI;                   // Portfolio profit / total exposure
double buffer_Portfolio_ROEContribution;       // Portfolio profit / account equity
double buffer_Portfolio_TPSLCautionROI;       // Based on ROI thresholds
double buffer_Portfolio_TPSLCautionROE;       // Based on ROE thresholds
double buffer_Portfolio_GrossLeverageContribution;  // Gross leverage at portfolio level
double buffer_Portfolio_HedgedExposure;            // Hedged exposure in USD
double buffer_Portfolio_HedgedPercentage;          // Portfolio hedged percentage
double buffer_Portfolio_SymbolCount;        // Number of symbols with open positions
double buffer_Portfolio_LeverageStdDev;     // Standard deviation of leverage contribution
double buffer_Portfolio_SumPositiveProfits;  // Accumulation of all positive profits across positions
double buffer_Portfolio_SumNegativeProfits;  // Accumulation of all negative profits across positions
double buffer_Portfolio_ProfitFactor;  // Profit Factor calculation (positive profits / absolute negative profits)

//+------------------------------------------------------------------+
//| Forward Declarations                                               |
//+------------------------------------------------------------------+
// Debug and validation functions
void DebugPrintBuffers();
void DebugPrintPortfolioCalculations();
bool ValidateCalculations();
bool ValidateROEBuffers();
void HandleError(const string message, const int errorCode = 0);

// Core processing functions
bool ProcessPortfolioCalculations();
bool ProcessDataGrouping();

// ROE calculation functions
void ResetProfitSums();
void CalculateProfitSums();
void CalculateAllocationProportion();
void CalculateLossCushionRatio();
bool ValidateAndCalculateSLThresholds();
bool ValidateRiskRewardRatios();
void CalculateTPThresholds();
void SetROENotifications();

// Display and formatting functions
void UpdateDisplay();
string FormatPrice(const double price, const string symbol);
void UpdateLabel(const string labelName, const string value, color textColor);

// Helper functions for calculations
int ArraySearch(const string &arr[], const string value);
double GetUSDConversionFactor(const string symbol);
double CalculateCrossRate(const double currentPrice, const string crossSymbol, const bool inverse);
string GetWeightClass(const double weight, const int symbolCount);
color GetWeightClassColor(const string weightClass);

// Status string conversion helpers
string GetNetPositionString(double value);
string GetTPSLString(double value);
string GetROESLString(double value);
string GetROETPString(double value);
string GetLeverageCautionString(double value);
string GetWeightClassString(double value);

// Portfolio related functions
string GetPortfolioNetPositionStr(double value);
string GetPortfolioTPSLROIStr(double value);
string GetPortfolioTPSLROEStr(double value);
string GetPortfolioLeverageStr(double value);
double CalculateLeverageStdDev(double &leverageArray[], int symbolCount);

// Risk assessment functions
void CalculateRiskAssessment();
int GetLeverageScore(double x);
string GetLeverageNotification(double x);
int GetSymbolCountScore(int y);
string GetSymbolCountNotification(int y);
int GetLeverageStdDevScore(double z);
string GetLeverageStdDevNotification(double z);


//+------------------------------------------------------------------+
//| Get USD conversion factor for currency pairs                       |
//+------------------------------------------------------------------+
double GetUSDConversionFactor(const string symbol)
  {

   if(!IsAllowedSymbol(symbol))
     {
      Print("Error: Attempting to get USD conversion for non-allowed symbol: ", symbol);
      return 0;
     }

   double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);

   if(bid == 0 || ask == 0)
     {
      Print("Error: Unable to fetch price for ", symbol);
      return double("N/A");
     }

   double currentPrice = (bid + ask) / 2;  // Use average of bid and ask

// Group 1: XAU, XAG, XTI, BTC, ETH
   if(StringFind(symbol, "XAUUSD") == 0 ||
      StringFind(symbol, "XAGUSD") == 0 ||
      StringFind(symbol, "XTIUSD") == 0 ||
      StringFind(symbol, "BTCUSD") == 0 ||
      StringFind(symbol, "ETHUSD") == 0)
     {
      return currentPrice;
     }

// Group 2: USD as base currency
   if(StringFind(symbol, "USDJPY") == 0 ||
      StringFind(symbol, "USDCAD") == 0 ||
      StringFind(symbol, "USDCHF") == 0)
     {
      return 1.0;
     }

// Group 3: EUR as base currency
   if(StringFind(symbol, "EURUSD") == 0)
      return currentPrice;
   else
      if(StringFind(symbol, "EURJPY") == 0)
         return CalculateCrossRate(currentPrice, "USDJPY.i", true);
      else
         if(StringFind(symbol, "EURGBP") == 0)
            return CalculateCrossRate(currentPrice, "GBPUSD.i", false);
         else
            if(StringFind(symbol, "EURAUD") == 0)
               return CalculateCrossRate(currentPrice, "AUDUSD.i", false);
            else
               if(StringFind(symbol, "EURNZD") == 0)
                  return CalculateCrossRate(currentPrice, "NZDUSD.i", false);
               else
                  if(StringFind(symbol, "EURCAD") == 0)
                     return CalculateCrossRate(currentPrice, "USDCAD.i", true);
                  else
                     if(StringFind(symbol, "EURCHF") == 0)
                        return CalculateCrossRate(currentPrice, "USDCHF.i", true);

                     // Group 4: GBP as base currency
                     else
                        if(StringFind(symbol, "GBPUSD") == 0)
                           return currentPrice;
                        else
                           if(StringFind(symbol, "GBPJPY") == 0)
                              return CalculateCrossRate(currentPrice, "USDJPY.i", true);
                           else
                              if(StringFind(symbol, "GBPAUD") == 0)
                                 return CalculateCrossRate(currentPrice, "AUDUSD.i", false);
                              else
                                 if(StringFind(symbol, "GBPNZD") == 0)
                                    return CalculateCrossRate(currentPrice, "NZDUSD.i", false);
                                 else
                                    if(StringFind(symbol, "GBPCAD") == 0)
                                       return CalculateCrossRate(currentPrice, "USDCAD.i", true);
                                    else
                                       if(StringFind(symbol, "GBPCHF") == 0)
                                          return CalculateCrossRate(currentPrice, "USDCHF.i", true);

                                       // Group 5: AUD as base currency
                                       else
                                          if(StringFind(symbol, "AUDUSD") == 0)
                                             return currentPrice;
                                          else
                                             if(StringFind(symbol, "AUDJPY") == 0)
                                                return CalculateCrossRate(currentPrice, "USDJPY.i", true);
                                             else
                                                if(StringFind(symbol, "AUDNZD") == 0)
                                                   return CalculateCrossRate(currentPrice, "NZDUSD.i", false);
                                                else
                                                   if(StringFind(symbol, "AUDCAD") == 0)
                                                      return CalculateCrossRate(currentPrice, "USDCAD.i", true);
                                                   else
                                                      if(StringFind(symbol, "AUDCHF") == 0)
                                                         return CalculateCrossRate(currentPrice, "USDCHF.i", true);

                                                      // Group 6: NZD as base currency
                                                      else
                                                         if(StringFind(symbol, "NZDUSD") == 0)
                                                            return currentPrice;
                                                         else
                                                            if(StringFind(symbol, "NZDJPY") == 0)
                                                               return CalculateCrossRate(currentPrice, "USDJPY.i", true);
                                                            else
                                                               if(StringFind(symbol, "NZDCAD") == 0)
                                                                  return CalculateCrossRate(currentPrice, "USDCAD.i", true);
                                                               else
                                                                  if(StringFind(symbol, "NZDCHF") == 0)
                                                                     return CalculateCrossRate(currentPrice, "USDCHF.i", true);

                                                                  // Group 7: CAD as base currency
                                                                  else
                                                                     if(StringFind(symbol, "CADJPY") == 0)
                                                                        return CalculateCrossRate(currentPrice, "USDJPY.i", true);
                                                                     else
                                                                        if(StringFind(symbol, "CADCHF") == 0)
                                                                           return CalculateCrossRate(currentPrice, "USDCHF.i", true);

                                                                        // Group 8: CHF as base currency
                                                                        else
                                                                           if(StringFind(symbol, "CHFJPY") == 0)
                                                                              return CalculateCrossRate(currentPrice, "USDJPY.i", true);

   Print("Error: Unrecognized symbol ", symbol);
   return double("N/A");
  }

//+------------------------------------------------------------------+
//| Helper function for cross rate calculations                        |
//+------------------------------------------------------------------+
double CalculateCrossRate(const double currentPrice, const string crossSymbol, const bool inverse)
  {

   string baseSymbol = crossSymbol;
   if(StringFind(crossSymbol, ".i") < 0)
      baseSymbol = crossSymbol + ".i";

   if(!IsAllowedSymbol(baseSymbol))
     {
      Print("Warning: Cross rate symbol not allowed: ", baseSymbol);
      return 0.0;
     }

   double bid = SymbolInfoDouble(crossSymbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(crossSymbol, SYMBOL_ASK);

   if(bid == 0 || ask == 0)
     {
      Print("Error: Unable to fetch price for ", crossSymbol);
      return double("N/A");
     }

   double avgRate = (bid + ask) / 2;
   return inverse ? currentPrice * (1.0 / avgRate) : currentPrice * avgRate;
  }

//+------------------------------------------------------------------+
//| Step 1: Raw Position Data Collection                               |
//+------------------------------------------------------------------+
bool ProcessStep1_RawData()
  {
   ArrayFree(g_RawPositions);
   int skippedSymbols = 0;

// Process positions
   for(int i = 0; i < PositionsTotal(); i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0)
        {
         Print("Error getting position ticket at index ", i,
               " Error code: ", GetLastError());
         continue;
        }

      string symbol = PositionGetString(POSITION_SYMBOL);
      if(!IsAllowedSymbol(symbol))
        {
         skippedSymbols++;
         continue;
        }

      RawPositionData pos;
      pos.ticket = ticket;
      pos.symbol = symbol;
      pos.volume = PositionGetDouble(POSITION_VOLUME);
      pos.positionType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
      pos.profit = PositionGetDouble(POSITION_PROFIT);
      pos.swap = PositionGetDouble(POSITION_SWAP);
      pos.isOpen = true;

      int size = ArraySize(g_RawPositions);
      ArrayResize(g_RawPositions, size + 1);
      g_RawPositions[size] = pos;
     }

// Process orders
   for(int i = 0; i < OrdersTotal(); i++)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket <= 0)
        {
         Print("Error getting order ticket at index ", i,
               " Error code: ", GetLastError());
         continue;
        }

      string symbol = OrderGetString(ORDER_SYMBOL);
      if(!IsAllowedSymbol(symbol))
        {
         skippedSymbols++;
         continue;
        }

      RawPositionData pos;
      pos.ticket = ticket;
      pos.symbol = symbol;
      pos.volume = OrderGetDouble(ORDER_VOLUME_CURRENT);
      pos.positionType = (ENUM_POSITION_TYPE)OrderGetInteger(ORDER_TYPE);
      pos.profit = 0;
      pos.swap = 0;
      pos.isOpen = false;

      int size = ArraySize(g_RawPositions);
      ArrayResize(g_RawPositions, size + 1);
      g_RawPositions[size] = pos;
     }

   if(skippedSymbols > 0)
      Print("Skipped ", skippedSymbols, " positions/orders with non-allowed symbols");

   return ProcessDataGrouping();
  }

//+------------------------------------------------------------------+
//| Process Data Grouping after Step 1                                 |
//+------------------------------------------------------------------+
bool ProcessDataGrouping()
  {
   string uniqueSymbols[];

   for(int i = 0; i < ArraySize(g_RawPositions); i++)
     {

      if(!IsAllowedSymbol(g_RawPositions[i].symbol))
         continue;

      bool found = false;
      for(int j = 0; j < ArraySize(uniqueSymbols); j++)
        {
         if(uniqueSymbols[j] == g_RawPositions[i].symbol)
           {
            found = true;
            break;
           }
        }

      if(!found)
        {
         int size = ArraySize(uniqueSymbols);
         ArrayResize(uniqueSymbols, size + 1);
         uniqueSymbols[size] = g_RawPositions[i].symbol;
        }
     }

   ArrayResize(g_FirstSplitData, ArraySize(uniqueSymbols));
   ArrayResize(g_SecondSplitData, ArraySize(uniqueSymbols));
   ArrayResize(g_ThirdSplitData, ArraySize(uniqueSymbols));

   for(int i = 0; i < ArraySize(uniqueSymbols); i++)
     {
      g_FirstSplitData[i].symbol = uniqueSymbols[i];
      g_SecondSplitData[i].symbol = uniqueSymbols[i];
      g_ThirdSplitData[i].symbol = uniqueSymbols[i];
     }

   return true;
  }

//+------------------------------------------------------------------+
//| Step 2: Directional Grouping                                       |
//+------------------------------------------------------------------+
bool ProcessStep2_DirectionalGrouping()
  {
   for(int i = 0; i < ArraySize(g_FirstSplitData); i++)
     {
      string currentSymbol = g_FirstSplitData[i].symbol;
      double buyVolume = 0;
      double sellVolume = 0;

      for(int j = 0; j < ArraySize(g_RawPositions); j++)
        {
         if(g_RawPositions[j].symbol == currentSymbol && g_RawPositions[j].isOpen)
           {
            if(g_RawPositions[j].positionType == POSITION_TYPE_BUY)
              {
               buyVolume += g_RawPositions[j].volume;
              }
            else
               if(g_RawPositions[j].positionType == POSITION_TYPE_SELL)
                 {
                  sellVolume += g_RawPositions[j].volume;
                 }
           }
        }

      g_FirstSplitData[i].buyVolume = buyVolume;
      g_FirstSplitData[i].sellVolume = sellVolume;
     }

   return true;
  }

//+------------------------------------------------------------------+
//| Step 3: Netting Buy/Sell Volumes                                  |
//+------------------------------------------------------------------+
bool ProcessStep3_Netting()
  {
   for(int i = 0; i < ArraySize(g_FirstSplitData); i++)
     {
      g_FirstSplitData[i].netVolume = g_FirstSplitData[i].buyVolume -
                                      g_FirstSplitData[i].sellVolume;
     }

   return true;
  }

//+------------------------------------------------------------------+
//| Step 4: Convert to Absolute Values                                |
//+------------------------------------------------------------------+
bool ProcessStep4_AbsoluteValues()
  {
   for(int i = 0; i < ArraySize(g_FirstSplitData); i++)
     {
      g_FirstSplitData[i].absoluteNetVolume = MathAbs(g_FirstSplitData[i].netVolume);
     }

   return true;
  }

//+------------------------------------------------------------------+
//| Step 5: USD Exposure Calculation                                  |
//+------------------------------------------------------------------+
bool ProcessStep5_Exposure()
  {
   g_TotalExposure = 0;

   for(int i = 0; i < ArraySize(g_FirstSplitData); i++)
     {
      string symbol = g_FirstSplitData[i].symbol;
      double contractSize = SymbolInfoDouble(symbol, SYMBOL_TRADE_CONTRACT_SIZE);
      double usdFactor = GetUSDConversionFactor(symbol);

      g_FirstSplitData[i].netExposure = g_FirstSplitData[i].absoluteNetVolume *
                                        contractSize *
                                        usdFactor;

      g_TotalExposure += g_FirstSplitData[i].netExposure;
     }

   return true;
  }

//+------------------------------------------------------------------+
//| Step 6: Non-directional Weight Calculation                        |
//+------------------------------------------------------------------+
bool ProcessStep6_NonDirectionalWeight()
  {
   if(g_TotalExposure <= 0)
     {
      Print("Error: Total exposure is zero or negative: ", g_TotalExposure);
      return false;
     }

   for(int i = 0; i < ArraySize(g_FirstSplitData); i++)
     {
      g_FirstSplitData[i].weight = (g_FirstSplitData[i].netExposure / g_TotalExposure) * 100;
     }

   return true;
  }

//+------------------------------------------------------------------+
//| Step 7: Convert Buy/Sell to Absolute Values                       |
//+------------------------------------------------------------------+
bool ProcessStep7_BuySellAbsolute()
  {
   for(int i = 0; i < ArraySize(g_FirstSplitData); i++)
     {
      g_FirstSplitData[i].buyVolume = MathAbs(g_FirstSplitData[i].buyVolume);
      g_FirstSplitData[i].sellVolume = MathAbs(g_FirstSplitData[i].sellVolume);
     }

   return true;
  }

//+------------------------------------------------------------------+
//| Step 8: Compare Magnitudes and Assign Net Position                |
//+------------------------------------------------------------------+
bool ProcessStep8_CompareMagnitudes()
  {
   for(int i = 0; i < ArraySize(g_FirstSplitData); i++)
     {
      double absBuy = MathAbs(g_FirstSplitData[i].buyVolume);
      double absSell = MathAbs(g_FirstSplitData[i].sellVolume);

      // Compare magnitudes and assign net position in one step
      if(absBuy > absSell)
         g_FirstSplitData[i].netPosition = "Net Long";
      else
         if(absBuy < absSell)
            g_FirstSplitData[i].netPosition = "Net Short";
         else
            g_FirstSplitData[i].netPosition = "Flat";
     }

   return true;
  }

//+------------------------------------------------------------------+
//| Step 9: Multiply Direction with Weights                           |
//+------------------------------------------------------------------+
bool ProcessStep9_DirectionalMultiply()
  {
   for(int i = 0; i < ArraySize(g_FirstSplitData); i++)
     {
      // Need to update these conditions to match new terminology
      int direction;
      if(g_FirstSplitData[i].netPosition == "Net Long")  // Changed from "Long"
         direction = 1;
      else
         if(g_FirstSplitData[i].netPosition == "Net Short")  // Changed from "Short"
            direction = -1;
         else
            direction = 0;

      g_FirstSplitData[i].directionalWeight = g_FirstSplitData[i].weight * direction;
     }

   return true;
  }

//+------------------------------------------------------------------+
//| Step 10: REMOVED                                  |
//+------------------------------------------------------------------+

// REMOVED

//+------------------------------------------------------------------+
//| Step 11: Display Net Directional Weight                           |
//+------------------------------------------------------------------+
bool ProcessStep11_NetDirectionalWeight()
  {
   return true;
  }

//+------------------------------------------------------------------+
//| Step 12: Profit and Swap Calculations                             |
//+------------------------------------------------------------------+
bool ProcessStep12_ProfitSwap()
  {
   for(int i = 0; i < ArraySize(g_SecondSplitData); i++)
     {
      string symbol = g_SecondSplitData[i].symbol;
      g_SecondSplitData[i].totalProfit = 0;
      g_SecondSplitData[i].totalSwap = 0;

      for(int j = 0; j < ArraySize(g_RawPositions); j++)
        {
         if(g_RawPositions[j].symbol == symbol && g_RawPositions[j].isOpen)
           {
            g_SecondSplitData[i].totalProfit += g_RawPositions[j].profit;
            g_SecondSplitData[i].totalSwap += g_RawPositions[j].swap;
           }
        }

      g_SecondSplitData[i].netProfitSwap = g_SecondSplitData[i].totalProfit + g_SecondSplitData[i].totalSwap;
     }

   return true;
  }

//+------------------------------------------------------------------+
//| Step 13: Position and Order Counting                              |
//+------------------------------------------------------------------+
bool ProcessStep13_Counting()
  {
   for(int i = 0; i < ArraySize(g_ThirdSplitData); i++)
     {
      string symbol = g_ThirdSplitData[i].symbol;
      g_ThirdSplitData[i].openPositions = 0;
      g_ThirdSplitData[i].pendingOrders = 0;

      for(int j = 0; j < ArraySize(g_RawPositions); j++)
        {
         if(g_RawPositions[j].symbol == symbol)
           {
            if(g_RawPositions[j].isOpen)
               g_ThirdSplitData[i].openPositions++;
            else
               g_ThirdSplitData[i].pendingOrders++;
           }
        }
     }

   return true;
  }

//+------------------------------------------------------------------+
//| All Additional Calculations                                      |
//+------------------------------------------------------------------+
bool CalculateExtendedMetrics()
  {
// Tasks A & B - Count pending orders
   for(int i = 0; i < ArraySize(g_ThirdSplitData); i++)
     {
      int pendingBuy = 0, pendingSell = 0;
      string symbol = g_ThirdSplitData[i].symbol;
      bool hasError = false;

      for(int j = 0; j < ArraySize(g_RawPositions); j++)
        {
         if(!g_RawPositions[j].isOpen && g_RawPositions[j].symbol == symbol)
           {
            ENUM_ORDER_TYPE orderType = (ENUM_ORDER_TYPE)g_RawPositions[j].positionType;
            switch(orderType)
              {
               case ORDER_TYPE_BUY_LIMIT:
                  pendingBuy++;
                  break;
               case ORDER_TYPE_BUY_STOP:
                  pendingBuy++;
                  break;
               case ORDER_TYPE_SELL_LIMIT:
                  pendingSell++;
                  break;
               case ORDER_TYPE_SELL_STOP:
                  pendingSell++;
                  break;
               default:
                  hasError = true;
                  break;
              }
           }
        }
      g_ThirdSplitData[i].pendingBuyCount = pendingBuy;
      g_ThirdSplitData[i].pendingSellCount = pendingSell;
     }

// Prepare arrays and get account equity
   int symbolCount = ArraySize(g_FirstSplitData);
   ArrayResize(buffer_TPSLCautionROI, symbolCount);
   ArrayResize(buffer_ROE_SL_Status, symbolCount);
   ArrayResize(buffer_ROE_TP_Status, symbolCount);
   ArrayResize(buffer_LeverageCaution, symbolCount);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);

// Calculate metrics with matched indices
   for(int i = 0; i < symbolCount; i++)
     {
      string symbol = g_FirstSplitData[i].symbol;
      int secondIndex = -1;

      // Find matching index in SecondSplitData
      for(int j = 0; j < ArraySize(g_SecondSplitData); j++)
        {
         if(g_SecondSplitData[j].symbol == symbol)
           {
            secondIndex = j;
            break;
           }
        }

      if(secondIndex >= 0)
        {
         // Calculate symbolTotalExposure and ROI
         double symbolTotalVolume = g_FirstSplitData[i].buyVolume + g_FirstSplitData[i].sellVolume;
         buffer_SymbolTotalExposure[i] = symbolTotalVolume * SymbolInfoDouble(symbol, SYMBOL_TRADE_CONTRACT_SIZE) * GetUSDConversionFactor(symbol);

         if(buffer_SymbolTotalExposure[i] > 0.0)
           {
            // Calculate ROI correctly
            g_FirstSplitData[i].roi = (g_SecondSplitData[secondIndex].netProfitSwap / (buffer_SymbolTotalExposure[i] - g_SecondSplitData[secondIndex].netProfitSwap)) * 100.0;

            // Set ROI caution
            g_FirstSplitData[i].tpSlCautionRoi =
               (g_FirstSplitData[i].roi > ROI_TP_Threshold) ? "TP Monitor" :
               (g_FirstSplitData[i].roi < ROI_SL_Threshold) ? "SL Monitor" :
               "---";
           }

         // ROE Caution
         if(equity > 0)
           {
            // Ensure indices match between data structures
            if(secondIndex >= 0) // This check is crucial for synchronization
              {
               double roeContribution = (g_SecondSplitData[secondIndex].netProfitSwap /
                                         (equity - g_SecondSplitData[secondIndex].netProfitSwap)) * 100;

               // Set SL Status - Match array indices
               buffer_ROE_SL_Status[i] =
                  (roeContribution < 0 && roeContribution < g_FirstSplitData[i].extendedLevelSL) ? -2.0 : // SL at Loss
                  (roeContribution < 0 && roeContribution < g_FirstSplitData[i].primaryLevelSL && roeContribution > g_FirstSplitData[i].extendedLevelSL) ? -1.0 :  // SL at Reduced Profit
                  0.0;  // No SL

               // Set TP Status - Match array indices
               buffer_ROE_TP_Status[i] =
                  (EnableThirdRR && roeContribution > 0 && roeContribution > g_FirstSplitData[i].thirdLevelTP) ? 3.0 :  // Third Level Tp
                  (EnableSecondRR && roeContribution > 0 && roeContribution > g_FirstSplitData[i].secondLevelTP && roeContribution < g_FirstSplitData[i].thirdLevelTP) ? 2.0 :  // Second Level TP
                  (roeContribution > 0 && roeContribution > g_FirstSplitData[i].firstLevelTP && roeContribution < g_FirstSplitData[i].secondLevelTP && roeContribution < g_FirstSplitData[i].thirdLevelTP) ? 1.0 : // First Level TP
                  0.0;

               // Store ROE values for validation
               buffer_ROEContribution[i] = roeContribution;
              }
           }

         // Leverage Caution
         double leverageContribution = g_FirstSplitData[i].netExposure / equity;
         g_FirstSplitData[i].leverageCaution =
            (leverageContribution > Leverage_Upper/100) ? "Over Leverage" :
            (leverageContribution < Leverage_Lower/100) ? "Under Leverage" :
            "Fair Leverage";

         // Store in buffer arrays
         buffer_TPSLCautionROI[i] =
            (g_FirstSplitData[i].tpSlCautionRoi == "TP Monitor") ? 1.0 :
            (g_FirstSplitData[i].tpSlCautionRoi == "SL Monitor") ? -1.0 : 0.0;

         buffer_LeverageCaution[i] =
            (g_FirstSplitData[i].leverageCaution == "Over Leverage") ? 1.0 :
            (g_FirstSplitData[i].leverageCaution == "Under Leverage") ? -1.0 : 0.0;
        }
     }

// Task F - Weight Ranking
   DisplayWeightRanking();
   return true;
  }

//+------------------------------------------------------------------+
//| Display Weight Ranking                                      |
//+------------------------------------------------------------------+
void DisplayWeightRanking()
  {
   int activeSymbols = 0;

// Count active symbols (with open positions)
   for(int i = 0; i < ArraySize(g_FirstSplitData); i++)
     {
      if(g_FirstSplitData[i].absoluteNetVolume > 0)
         activeSymbols++;
     }

// Create arrays for sorting
   string symbols[];
   double weights[];
   int indices[];

   ArrayResize(symbols, activeSymbols);
   ArrayResize(weights, activeSymbols);
   ArrayResize(indices, activeSymbols);

// Fill arrays with active symbols data
   int idx = 0;
   for(int i = 0; i < ArraySize(g_FirstSplitData); i++)
     {
      if(g_FirstSplitData[i].absoluteNetVolume > 0)
        {
         symbols[idx] = g_FirstSplitData[i].symbol;
         weights[idx] = g_FirstSplitData[i].weight;
         indices[idx] = i;
         idx++;
        }
     }

// Sort by weight in descending order
   for(int i = 0; i < activeSymbols - 1; i++)
     {
      for(int j = i + 1; j < activeSymbols; j++)
        {
         if(weights[j] > weights[i])
           {
            // Swap weights
            double tempWeight = weights[i];
            weights[i] = weights[j];
            weights[j] = tempWeight;

            // Swap symbols
            string tempSymbol = symbols[i];
            symbols[i] = symbols[j];
            symbols[j] = tempSymbol;

            // Swap indices
            int tempIndex = indices[i];
            indices[i] = indices[j];
            indices[j] = tempIndex;
           }
        }
     }


   for(int i = 0; i < activeSymbols; i++)
     {
      g_FirstSplitData[indices[i]].weightRank = i + 1;

     }

  }

//+------------------------------------------------------------------+
//| Calculate Standard Deviation of Leverage Contribution               |
//+------------------------------------------------------------------+
double CalculateLeverageStdDev(double &leverageArray[], int symbolCount)
  {
   if(symbolCount <= 0)  // Changed from <= 1 to <= 0
      return 0.0;

// Calculate mean
   double sum = 0;
   for(int i = 0; i < ArraySize(leverageArray); i++)
     {
      if(buffer_OpenPositions[i] > 0)  // Only consider symbols with open positions
         sum += leverageArray[i];
     }
   double mean = sum / symbolCount;

// Calculate variance
   double variance = 0;
   for(int i = 0; i < ArraySize(leverageArray); i++)
     {
      if(buffer_OpenPositions[i] > 0)  // Only consider symbols with open positions
         variance += MathPow(leverageArray[i] - mean, 2);
     }
   variance /= symbolCount;  // Changed from (symbolCount - 1) to symbolCount

// Return standard deviation
   return MathSqrt(variance);
  }

//+------------------------------------------------------------------+
//|  ROE Calculation Functions - Step 1                              |
//+------------------------------------------------------------------+
void ResetProfitSums()
  {
   for(int i = 0; i < ArraySize(g_SecondSplitData); i++)
     {
      g_SecondSplitData[i].positiveNetProfitSwap = 0;
      g_SecondSplitData[i].negativeNetProfitSwap = 0;
     }
  }

//+------------------------------------------------------------------+
//| ROE Calculation Functions - Step 2                               |
//+------------------------------------------------------------------+
void CalculateProfitSums()
  {
   for(int i = 0; i < ArraySize(g_SecondSplitData); i++)
     {
      if(g_ThirdSplitData[i].openPositions > 0)  // Only consider symbols with open positions
        {
         if(g_SecondSplitData[i].netProfitSwap > 0)
            g_SecondSplitData[i].positiveNetProfitSwap = g_SecondSplitData[i].netProfitSwap;
         else
            if(g_SecondSplitData[i].netProfitSwap < 0)
               g_SecondSplitData[i].negativeNetProfitSwap = g_SecondSplitData[i].netProfitSwap;
        }
     }
  }

//+------------------------------------------------------------------+
//|  ROE Calculation Functions - Step 3                              |
//+------------------------------------------------------------------+
void CalculateAllocationProportion()
  {
   double sumNegativeProfits = 0;
   bool hasNegativeProfit = false;

// Calculate sum of negative profits
   for(int i = 0; i < ArraySize(g_SecondSplitData); i++)
     {
      if(g_ThirdSplitData[i].openPositions > 0 && g_SecondSplitData[i].negativeNetProfitSwap < 0)
        {
         sumNegativeProfits += g_SecondSplitData[i].negativeNetProfitSwap;
         hasNegativeProfit = true;
        }
     }

// Calculate allocation proportions
   if(hasNegativeProfit && sumNegativeProfits != 0)
     {
      for(int i = 0; i < ArraySize(g_SecondSplitData); i++)
        {
         if(g_ThirdSplitData[i].openPositions > 0)
           {
            if(g_SecondSplitData[i].netProfitSwap < 0)
              {
               g_SecondSplitData[i].allocateProportion = g_SecondSplitData[i].negativeNetProfitSwap / sumNegativeProfits;
              }
            else
              {
               g_SecondSplitData[i].allocateProportion = 0;
              }
           }
        }
     }
  }

//+------------------------------------------------------------------+
//|   ROE Calculation Functions - Step 4                             |
//+------------------------------------------------------------------+
void CalculateLossCushionRatio()
  {
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   if(equity <= 0)
      return;

   for(int i = 0; i < ArraySize(g_SecondSplitData); i++)
     {
      if(g_ThirdSplitData[i].openPositions > 0)
        {
         // Calculate loss cushion considering positive profits from other positions
         double additionalCushion = 0;
         for(int j = 0; j < ArraySize(g_SecondSplitData); j++)
           {
            if(j != i && g_SecondSplitData[j].positiveNetProfitSwap > 0)
              {
               additionalCushion += g_SecondSplitData[j].positiveNetProfitSwap * g_SecondSplitData[i].allocateProportion;
              }
           }

         // Calculate loss cushion ratio
         if(equity > g_SecondSplitData[i].netProfitSwap)
           {
            g_SecondSplitData[i].lossCushionRatio = (additionalCushion / (equity - g_SecondSplitData[i].netProfitSwap)) * 100;
           }
        }
     }
  }

//+------------------------------------------------------------------+
//| Calculate Sum of Positive Profits - Add In Calculation           |
//+------------------------------------------------------------------+
double SumPositiveProfits()
  {
   double sumPositiveProfits = 0;

// Loop through each position
   for(int i = 0; i < ArraySize(g_SecondSplitData); i++)
     {
      // Only consider positions with open positions
      if(g_ThirdSplitData[i].openPositions > 0)
        {
         // Add only positive profits
         if(g_SecondSplitData[i].positiveNetProfitSwap > 0)
           {
            sumPositiveProfits += g_SecondSplitData[i].positiveNetProfitSwap;
           }
        }
     }

   return sumPositiveProfits;
  }

//+------------------------------------------------------------------+
//| Calculate Sum of Negative Profits - Add In Calculation           |
//+------------------------------------------------------------------+
double SumNegativeProfits()
  {
   double sumNegativeProfits = 0;

// Loop through each position
   for(int i = 0; i < ArraySize(g_SecondSplitData); i++)
     {
      // Only consider positions with open positions
      if(g_ThirdSplitData[i].openPositions > 0)
        {
         // Add only negative profits
         if(g_SecondSplitData[i].negativeNetProfitSwap < 0)
           {
            sumNegativeProfits += g_SecondSplitData[i].negativeNetProfitSwap;
           }
        }
     }

   return sumNegativeProfits;
  }

//+------------------------------------------------------------------+
//|     ROE Calculation Functions - Step 5                           |
//+------------------------------------------------------------------+
bool ValidateAndCalculateSLThresholds()
  {
   if(Portfolio_ROE_SL_Threshold >= 0)
      return false;  // Invalid SL threshold

   for(int i = 0; i < ArraySize(g_FirstSplitData); i++)
     {
      if(g_ThirdSplitData[i].openPositions > 0)
        {
         // Calculate Primary Level based on weight
         g_FirstSplitData[i].primaryLevelSL = (Portfolio_ROE_SL_Threshold * g_FirstSplitData[i].weight) / 100.0;

         // Calculate Extended Level using loss cushion
         g_FirstSplitData[i].extendedLevelSL = g_FirstSplitData[i].primaryLevelSL +
                                               (g_SecondSplitData[i].lossCushionRatio * -1);
        }
     }
   return true;
  }

//+------------------------------------------------------------------+
//|      ROE Calculation Functions - Step 6                          |
//+------------------------------------------------------------------+
bool ValidateRiskRewardRatios()
  {
// Validate First Level
   if(FirstRiskRewardRatio <= 0)
      return false;

// Validate Second Level if enabled
   if(EnableSecondRR && SecondRiskRewardRatio <= FirstRiskRewardRatio)
      return false;

// Validate Third Level if enabled
   if(EnableThirdRR && ThirdRiskRewardRatio <= SecondRiskRewardRatio)
      return false;

   return true;
  }

//+------------------------------------------------------------------+
//|      ROE Calculation Functions - Step 7                          |
//+------------------------------------------------------------------+
void CalculateTPThresholds()
  {
   for(int i = 0; i < ArraySize(g_FirstSplitData); i++)
     {
      if(g_ThirdSplitData[i].openPositions > 0)
        {
         // First Level TP
         g_FirstSplitData[i].firstLevelTP = g_FirstSplitData[i].primaryLevelSL * -1 * FirstRiskRewardRatio;

         // Second Level TP if enabled
         if(EnableSecondRR)
            g_FirstSplitData[i].secondLevelTP = g_FirstSplitData[i].primaryLevelSL * -1 * SecondRiskRewardRatio;

         // Third Level TP if enabled
         if(EnableThirdRR)
            g_FirstSplitData[i].thirdLevelTP = g_FirstSplitData[i].primaryLevelSL * -1 * ThirdRiskRewardRatio;
        }
     }
  }

//+------------------------------------------------------------------+
//|       ROE Calculation Functions - Step 8                         |
//+------------------------------------------------------------------+
void SetROENotifications()
  {
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   if(equity <= 0)
      return;

   for(int i = 0; i < ArraySize(g_FirstSplitData); i++)  // Use g_FirstSplitData as base array
     {
      // Find matching index in SecondSplitData for synchronization
      string symbol = g_FirstSplitData[i].symbol;
      int secondIndex = -1;

      for(int j = 0; j < ArraySize(g_SecondSplitData); j++)
        {
         if(g_SecondSplitData[j].symbol == symbol)
           {
            secondIndex = j;
            break;
           }
        }

      if(secondIndex >= 0 && g_ThirdSplitData[i].openPositions > 0)
        {
         double roeContribution = (g_SecondSplitData[secondIndex].netProfitSwap /
                                   (equity - g_SecondSplitData[secondIndex].netProfitSwap)) * 100;

         // Set SL notifications
         if(roeContribution < 0 && roeContribution < g_FirstSplitData[i].extendedLevelSL)
           {
            g_SecondSplitData[secondIndex].slNotification = "SL at Loss";
            buffer_ROE_SL_Status[i] = -2.0;
           }
         else
            if(roeContribution < 0 && roeContribution < g_FirstSplitData[i].primaryLevelSL && roeContribution > g_FirstSplitData[i].extendedLevelSL)
              {
               g_SecondSplitData[secondIndex].slNotification = "SL at Reduced Profit";
               buffer_ROE_SL_Status[i] = -1.0;
              }
            else
              {
               g_SecondSplitData[secondIndex].slNotification = "---";
               buffer_ROE_SL_Status[i] = 0.0;
              }

         // Set TP notifications
         if(EnableThirdRR && roeContribution > 0 && roeContribution > g_FirstSplitData[i].thirdLevelTP)
           {
            g_SecondSplitData[secondIndex].tpNotification = "Third TP Range";
            buffer_ROE_TP_Status[i] = 3.0;
           }
         else
            if(EnableSecondRR && roeContribution > 0 && roeContribution > g_FirstSplitData[i].secondLevelTP && roeContribution < g_FirstSplitData[i].thirdLevelTP)
              {
               g_SecondSplitData[secondIndex].tpNotification = "Second TP Range";
               buffer_ROE_TP_Status[i] = 2.0;
              }
            else
               if(roeContribution > 0 && roeContribution > g_FirstSplitData[i].firstLevelTP && roeContribution < g_FirstSplitData[i].secondLevelTP && roeContribution < g_FirstSplitData[i].thirdLevelTP)
                 {
                  g_SecondSplitData[secondIndex].tpNotification = "First TP Range";
                  buffer_ROE_TP_Status[i] = 1.0;
                 }
               else
                 {
                  g_SecondSplitData[secondIndex].tpNotification = "---";
                  buffer_ROE_TP_Status[i] = 0.0;
                 }
        }
     }
  }

//+------------------------------------------------------------------+
//| Display Functions                                                  |
//+------------------------------------------------------------------+
void UpdateDisplay()
  {
// Create header rectangle
   string headerRectName = "Header_Rectangle";
   if(ObjectFind(0, headerRectName) == -1)
     {
      ObjectCreate(0, headerRectName, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(0, headerRectName, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, headerRectName, OBJPROP_XDISTANCE, LabelX);
      ObjectSetInteger(0, headerRectName, OBJPROP_YDISTANCE, StartY - HeaderHeight);
      ObjectSetInteger(0, headerRectName, OBJPROP_XSIZE, FirstColumnWidth + SecondColumnWidth);
      ObjectSetInteger(0, headerRectName, OBJPROP_YSIZE, HeaderHeight);
      ObjectSetInteger(0, headerRectName, OBJPROP_BGCOLOR, HeaderColor);
      ObjectSetInteger(0, headerRectName, OBJPROP_BORDER_TYPE, BORDER_FLAT);
      ObjectSetInteger(0, headerRectName, OBJPROP_COLOR, HeaderTextColor);
     }

// Create header text
   string headerTextName = "Header_Text";
   if(ObjectFind(0, headerTextName) == -1)
     {
      ObjectCreate(0, headerTextName, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, headerTextName, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, headerTextName, OBJPROP_XDISTANCE, LabelX + 5);
      ObjectSetInteger(0, headerTextName, OBJPROP_YDISTANCE, StartY - HeaderHeight + 5);
      ObjectSetString(0, headerTextName, OBJPROP_TEXT, HeaderText);
      ObjectSetString(0, headerTextName, OBJPROP_FONT, "Arial");
      ObjectSetInteger(0, headerTextName, OBJPROP_FONTSIZE, FontSize);
      ObjectSetInteger(0, headerTextName, OBJPROP_COLOR, HeaderTextColor);
     }

// Create separator line
   string separatorName = "Separator_Line";
   if(ObjectFind(0, separatorName) == -1)
     {
      ObjectCreate(0, separatorName, OBJ_HLINE, 0, 0, 0);
      ObjectSetInteger(0, separatorName, OBJPROP_COLOR, SeparatorColor);
      ObjectSetInteger(0, separatorName, OBJPROP_STYLE, STYLE_SOLID);
      ObjectSetInteger(0, separatorName, OBJPROP_WIDTH, 1);
      ObjectSetDouble(0, separatorName, OBJPROP_PRICE, StartY);
     }

   string currentSymbol = Symbol();

   int firstSplitIndex = -1;
   int secondSplitIndex = -1;
   int thirdSplitIndex = -1;

   for(int i = 0; i < ArraySize(g_FirstSplitData); i++)
     {
      if(g_FirstSplitData[i].symbol == currentSymbol)
        {
         firstSplitIndex = i;
         break;
        }
     }

   for(int i = 0; i < ArraySize(g_SecondSplitData); i++)
     {
      if(g_SecondSplitData[i].symbol == currentSymbol)
        {
         secondSplitIndex = i;
         break;
        }
     }

   for(int i = 0; i < ArraySize(g_ThirdSplitData); i++)
     {
      if(g_ThirdSplitData[i].symbol == currentSymbol)
        {
         thirdSplitIndex = i;
         break;
        }
     }

   UpdateDisplayValues(firstSplitIndex, secondSplitIndex, thirdSplitIndex);
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void UpdateDisplayValues(const int firstSplitIndex, const int secondSplitIndex, const int thirdSplitIndex)
  {
   if(firstSplitIndex >= 0)
     {
      g_weightClass = GetWeightClass(g_FirstSplitData[firstSplitIndex].weight,
                                     ArraySize(g_FirstSplitData));

      UpdateLabel("Symbol", Symbol(), TextColor);
      UpdateLabel("Net Position", g_FirstSplitData[firstSplitIndex].netPosition, TextColor);
      UpdateLabel("Net Lot Size", DoubleToString(g_FirstSplitData[firstSplitIndex].absoluteNetVolume, 2), TextColor);
      UpdateLabel("Net Exposure", DoubleToString(g_FirstSplitData[firstSplitIndex].netExposure, 2) + " USD", TextColor);
      UpdateLabel("Directional Weight", DoubleToString(g_FirstSplitData[firstSplitIndex].directionalWeight, 2) + "%", TextColor);
      UpdateLabel("Weight Class", g_weightClass, GetWeightClassColor(g_weightClass));

      double leverage = g_FirstSplitData[firstSplitIndex].netExposure / AccountInfoDouble(ACCOUNT_EQUITY);
      UpdateLabel("Leverage Contribution", DoubleToString(leverage, 4) + "x", TextColor);
     }

   if(secondSplitIndex >= 0)
     {
      UpdateLabel("P/L - net Swap", DoubleToString(g_SecondSplitData[secondSplitIndex].netProfitSwap, 2) + " USD", TextColor);

      double equity = AccountInfoDouble(ACCOUNT_EQUITY);
      if(equity > 0)
        {
         double profitNetSwap = g_SecondSplitData[secondSplitIndex].netProfitSwap;
         double roe = (profitNetSwap / (equity - profitNetSwap)) * 100;
         UpdateLabel("ROE Contribution", DoubleToString(roe, 4) + "%", TextColor);
        }
     }

   if(thirdSplitIndex >= 0)
     {
      UpdateLabel("#Open", IntegerToString(g_ThirdSplitData[thirdSplitIndex].openPositions), TextColor);
      UpdateLabel("#Pending", IntegerToString(g_ThirdSplitData[thirdSplitIndex].pendingOrders), TextColor);
     }
  }

//+------------------------------------------------------------------+
//| Get weight class based on weight and symbol count                  |
//+------------------------------------------------------------------+
string GetWeightClass(const double weight, const int symbolCount)
  {

// At the start of the function, convert percentage to decimal
   double Weight_Deviation = Weight_Deviation_Percent / 100.0;

   if(symbolCount <= 0)
     {
      Print("Warning: Invalid symbol count");
      return "Unknown";
     }

   double avgWeight = 100.0 / symbolCount;

   if(weight > (1 + Weight_Deviation) * avgWeight)
      return "Over-weight";
   else
      if(weight < (1 - Weight_Deviation) * avgWeight)
         return "Under-weight";
      else
         return "Balanced-weight";
  }

//+------------------------------------------------------------------+
//| Get color for weight class                                         |
//+------------------------------------------------------------------+
color GetWeightClassColor(const string weightClass)
  {
   if(weightClass == "Over-weight")
      return clrRed;
   else
      if(weightClass == "Under-weight")
         return clrGreen;
   return clrBlue;  // Balanced-weight
  }

//+------------------------------------------------------------------+
//| Update individual label                                            |
//+------------------------------------------------------------------+
void UpdateLabel(const string labelName, const string value, color textColor)
  {
// Create label name
   string labelObjName = "Label_" + labelName;
   string valueObjName = "Value_" + labelName;
   int y = StartY + ArraySearch(g_LabelNames, labelName) * YStep;

// Create label text
   if(ObjectFind(0, labelObjName) == -1)
     {
      ObjectCreate(0, labelObjName, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, labelObjName, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, labelObjName, OBJPROP_XDISTANCE, LabelX + 5);
      ObjectSetInteger(0, labelObjName, OBJPROP_YDISTANCE, y);
      ObjectSetString(0, labelObjName, OBJPROP_TEXT, labelName + " :");
      ObjectSetString(0, labelObjName, OBJPROP_FONT, "Arial");
      ObjectSetInteger(0, labelObjName, OBJPROP_FONTSIZE, FontSize);
      ObjectSetInteger(0, labelObjName, OBJPROP_COLOR, TextColor);
     }

// Create value text
   if(ObjectFind(0, valueObjName) == -1)
     {
      ObjectCreate(0, valueObjName, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, valueObjName, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, valueObjName, OBJPROP_XDISTANCE, ValueX);
      ObjectSetInteger(0, valueObjName, OBJPROP_YDISTANCE, y);
      ObjectSetString(0, valueObjName, OBJPROP_FONT, "Arial");
      ObjectSetInteger(0, valueObjName, OBJPROP_FONTSIZE, FontSize);
     }

   ObjectSetString(0, valueObjName, OBJPROP_TEXT, value);
   ObjectSetInteger(0, valueObjName, OBJPROP_COLOR, textColor);
  }

//+------------------------------------------------------------------+
//| Helper function to search array                                    |
//+------------------------------------------------------------------+
int ArraySearch(const string &arr[], const string value)
  {
   for(int i = 0; i < ArraySize(arr); i++)
     {
      if(arr[i] == value)
         return i;
     }
   return 0;
  }

//+------------------------------------------------------------------+
//| Helper function for price formatting                               |
//+------------------------------------------------------------------+
string FormatPrice(const double price, const string symbol)
  {
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   return DoubleToString(price, digits);
  }

//+------------------------------------------------------------------+
//| Custom functions for calculation checks                            |
//+------------------------------------------------------------------+
bool ValidateCalculations()
  {
   if(g_TotalExposure <= 0)
     {
      Print("Warning: Total exposure is zero or negative");
      return false;
     }

   double totalWeight = 0;
   for(int i = 0; i < ArraySize(g_FirstSplitData); i++)
     {
      totalWeight += g_FirstSplitData[i].weight;
     }

   if(MathAbs(totalWeight - 100.0) > 0.1)
     {
      Print("Warning: Total weight is not 100%: ", totalWeight);
      return false;
     }

   return true;
  }

//+------------------------------------------------------------------+
//| Validation of ROE Buffers                                        |
//+------------------------------------------------------------------+
bool ValidateROEBuffers()
  {
// First check if arrays are properly sized
   int bufferSize = ArraySize(g_FirstSplitData);

// Resize ROE status buffers to match FirstSplitData size
   ArrayResize(buffer_ROE_SL_Status, bufferSize);
   ArrayResize(buffer_ROE_TP_Status, bufferSize);

// Initialize arrays with default values
   ArrayInitialize(buffer_ROE_SL_Status, 0.0);
   ArrayInitialize(buffer_ROE_TP_Status, 0.0);

// Check buffer sizes
   if(ArraySize(buffer_ROE_SL_Status) != ArraySize(buffer_ROE_TP_Status))
     {
      Print("Error: ROE status buffer size mismatch");
      return false;
     }

// Validate status values with bounds checking
   for(int i = 0; i < ArraySize(buffer_ROE_SL_Status) && i < bufferSize; i++)
     {
      // Validate SL Status values (-2.0 = SL at Loss, -1.0 = SL at Reduced Profit, 0.0 = No SL)
      if(buffer_ROE_SL_Status[i] != 0.0 &&
         buffer_ROE_SL_Status[i] != -1.0 &&
         buffer_ROE_SL_Status[i] != -2.0)
        {
         Print("Error: Invalid ROE SL status value: ", buffer_ROE_SL_Status[i]);
         return false;
        }

      // Validate TP Status values (0.0 = No TP, 1.0 = First TP, 2.0 = Second TP, 3.0 = Third TP)
      if(buffer_ROE_TP_Status[i] != 0.0 &&
         buffer_ROE_TP_Status[i] != 1.0 &&
         buffer_ROE_TP_Status[i] != 2.0 &&
         buffer_ROE_TP_Status[i] != 3.0)
        {
         Print("Error: Invalid ROE TP status value: ", buffer_ROE_TP_Status[i]);
         return false;
        }
     }
   return true;
  }

//+------------------------------------------------------------------+
//| Error handling function                                            |
//+------------------------------------------------------------------+
void HandleError(const string message, const int errorCode = 0)
  {
   string fullMessage = message;
   if(errorCode != 0)
      fullMessage += " Error code: " + IntegerToString(errorCode);

   Print(fullMessage);
  }

//+------------------------------------------------------------------+
//| Main Program Functions                                             |
//+------------------------------------------------------------------+
int OnInit()
  {
   Print("Initializing Symbol Information indicator");

// Symbol Level Thresholds validation
   if(ROI_SL_Threshold >= 0)
     {
      Print("Error: ROI_SL_Threshold must be negative");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(ROI_TP_Threshold <= 0)
     {
      Print("Error: ROI_TP_Threshold must be positive");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(Weight_Deviation_Percent <= 0)
     {
      Print("Error: Weight_Deviation_Percent must be positive");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(Leverage_Upper <= 0 || Leverage_Lower <= 0)
     {
      Print("Error: Leverage thresholds must be positive");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(Leverage_Upper <= Leverage_Lower)
     {
      Print("Error: Leverage_Upper must be greater than Leverage_Lower");
      return INIT_PARAMETERS_INCORRECT;
     }

// Portfolio Level Thresholds validation
   if(Portfolio_ROE_SL_Threshold >= 0)
     {
      Print("Error: Portfolio_ROE_SL_Threshold must be negative");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(Portfolio_ROE_TP_Threshold <= 0)
     {
      Print("Error: Portfolio_ROE_TP_Threshold must be positive");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(Portfolio_ROI_SL_Threshold >= 0)
     {
      Print("Error: Portfolio_ROI_SL_Threshold must be negative");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(Portfolio_ROI_TP_Threshold <= 0)
     {
      Print("Error: Portfolio_ROI_TP_Threshold must be positive");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(Portfolio_Leverage_Upper <= 0 || Portfolio_Leverage_Lower <= 0)
     {
      Print("Error: Portfolio Leverage thresholds must be positive");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(Portfolio_Leverage_Upper <= Portfolio_Leverage_Lower)
     {
      Print("Error: Portfolio_Leverage_Upper must be greater than Portfolio_Leverage_Lower");
      return INIT_PARAMETERS_INCORRECT;
     }

// Risk Assessment Parameters validation
   if(HighRiskThreshold <= 0 || MediumHighThreshold <= 0 || MediumLowThreshold <= 0)
     {
      Print("Error: Risk thresholds must be positive");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(!(HighRiskThreshold > MediumHighThreshold && MediumHighThreshold > MediumLowThreshold))
     {
      Print("Error: Risk thresholds must be in descending order: High > MediumHigh > MediumLow");
      return INIT_PARAMETERS_INCORRECT;
     }

// Risk-Reward Ratio Settings validation
   if(FirstRiskRewardRatio <= 0 || SecondRiskRewardRatio <= 0 || ThirdRiskRewardRatio <= 0)
     {
      Print("Error: Risk-Reward ratios must be positive");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(!(ThirdRiskRewardRatio > SecondRiskRewardRatio && SecondRiskRewardRatio > FirstRiskRewardRatio))
     {
      Print("Error: Risk-Reward ratios must be in ascending order: Third > Second > First");
      return INIT_PARAMETERS_INCORRECT;
     }

// Rest of the initialization code...
   if(!InitializeBuffers())
     {
      Print("Failed to initialize buffers");
      return INIT_FAILED;
     }

// Initialize buffers with safety checks
   if(!InitializeBuffers())
     {
      Print("Failed to initialize buffers");
      return INIT_FAILED;
     }

// Set existing indicator buffers
   SetIndexBuffer(0, buffer_AbsoluteNetVolume, INDICATOR_DATA);
   SetIndexBuffer(1, buffer_NetPosition, INDICATOR_DATA);
   SetIndexBuffer(2, buffer_OpenPositions, INDICATOR_DATA);
   SetIndexBuffer(3, buffer_PendingOrders, INDICATOR_DATA);
   SetIndexBuffer(4, buffer_NetProfitSwap, INDICATOR_DATA);
   SetIndexBuffer(5, buffer_TotalSwap, INDICATOR_DATA);
   SetIndexBuffer(6, buffer_ROI, INDICATOR_DATA);
   SetIndexBuffer(7, buffer_NetExposure, INDICATOR_DATA);
   SetIndexBuffer(8, buffer_Weight, INDICATOR_DATA);
   SetIndexBuffer(9, buffer_DirectionalWeight, INDICATOR_DATA);
   SetIndexBuffer(10, buffer_WeightRank, INDICATOR_DATA);
   SetIndexBuffer(11, buffer_ROEContribution, INDICATOR_DATA);
   SetIndexBuffer(12, buffer_LeverageContribution, INDICATOR_DATA);
   SetIndexBuffer(13, buffer_PendingBuyCount, INDICATOR_DATA);
   SetIndexBuffer(14, buffer_PendingSellCount, INDICATOR_DATA);
   SetIndexBuffer(15, buffer_TotalProfit, INDICATOR_DATA);
   SetIndexBuffer(16, buffer_TPSLCautionROI, INDICATOR_DATA);
   SetIndexBuffer(17, buffer_ROE_SL_Status, INDICATOR_DATA);
   SetIndexBuffer(18, buffer_ROE_TP_Status, INDICATOR_DATA);
   SetIndexBuffer(19, buffer_LeverageCaution, INDICATOR_DATA);
   SetIndexBuffer(20, buffer_WeightClass, INDICATOR_DATA);
   SetIndexBuffer(21, buffer_SymbolTotalExposure, INDICATOR_DATA);

// Set additional ROE indicator buffers
   SetIndexBuffer(22, buffer_PositiveNetProfitSwap, INDICATOR_DATA);
   SetIndexBuffer(23, buffer_NegativeNetProfitSwap, INDICATOR_DATA);
   SetIndexBuffer(24, buffer_AllocationProportion, INDICATOR_DATA);
   SetIndexBuffer(25, buffer_LossCushionRatio, INDICATOR_DATA);
   SetIndexBuffer(26, buffer_PrimaryLevelSL, INDICATOR_DATA);
   SetIndexBuffer(27, buffer_ExtendedLevelSL, INDICATOR_DATA);
   SetIndexBuffer(28, buffer_FirstLevelTP, INDICATOR_DATA);
   SetIndexBuffer(29, buffer_SecondLevelTP, INDICATOR_DATA);
   SetIndexBuffer(30, buffer_ThirdLevelTP, INDICATOR_DATA);

   EventSetTimer(1);

   g_AccountCurrency = AccountInfoString(ACCOUNT_CURRENCY);
   if(g_AccountCurrency == "")
     {
      Print("Error: Cannot determine account currency");
      return INIT_FAILED;
     }

   g_ValueX = LabelX + FirstColumnWidth;

   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| Initialization of Buffers                                        |
//+------------------------------------------------------------------+
bool InitializeBuffers()
  {
   int initialSize = 1000;

// Existing buffer resizing
   if(!ArrayResize(buffer_AbsoluteNetVolume, initialSize) ||
      !ArrayResize(buffer_NetPosition, initialSize) ||
      !ArrayResize(buffer_OpenPositions, initialSize) ||
      !ArrayResize(buffer_PendingOrders, initialSize) ||
      !ArrayResize(buffer_NetProfitSwap, initialSize) ||
      !ArrayResize(buffer_TotalSwap, initialSize) ||
      !ArrayResize(buffer_ROI, initialSize) ||
      !ArrayResize(buffer_NetExposure, initialSize) ||
      !ArrayResize(buffer_Weight, initialSize) ||
      !ArrayResize(buffer_DirectionalWeight, initialSize) ||
      !ArrayResize(buffer_WeightRank, initialSize) ||
      !ArrayResize(buffer_ROEContribution, initialSize) ||
      !ArrayResize(buffer_LeverageContribution, initialSize) ||
      !ArrayResize(buffer_PendingBuyCount, initialSize) ||
      !ArrayResize(buffer_PendingSellCount, initialSize) ||
      !ArrayResize(buffer_TotalProfit, initialSize) ||
      !ArrayResize(buffer_TPSLCautionROI, initialSize) ||
      !ArrayResize(buffer_ROE_SL_Status, initialSize) ||
      !ArrayResize(buffer_ROE_TP_Status, initialSize) ||
      !ArrayResize(buffer_LeverageCaution, initialSize) ||
      !ArrayResize(buffer_WeightClass, initialSize) ||
      !ArrayResize(buffer_SymbolTotalExposure, initialSize) ||
// Additional ROE buffer resizing
      !ArrayResize(buffer_PositiveNetProfitSwap, initialSize) ||
      !ArrayResize(buffer_NegativeNetProfitSwap, initialSize) ||
      !ArrayResize(buffer_AllocationProportion, initialSize) ||
      !ArrayResize(buffer_LossCushionRatio, initialSize) ||
      !ArrayResize(buffer_PrimaryLevelSL, initialSize) ||
      !ArrayResize(buffer_ExtendedLevelSL, initialSize) ||
      !ArrayResize(buffer_FirstLevelTP, initialSize) ||
      !ArrayResize(buffer_SecondLevelTP, initialSize) ||
      !ArrayResize(buffer_ThirdLevelTP, initialSize))
     {
      Print("Failed to resize one or more buffers");
      return false;
     }

// Initialize existing buffers
   ArrayInitialize(buffer_AbsoluteNetVolume, 0.0);
   ArrayInitialize(buffer_NetPosition, 0.0);
   ArrayInitialize(buffer_OpenPositions, 0.0);
   ArrayInitialize(buffer_PendingOrders, 0.0);
   ArrayInitialize(buffer_NetProfitSwap, 0.0);
   ArrayInitialize(buffer_TotalSwap, 0.0);
   ArrayInitialize(buffer_ROI, 0.0);
   ArrayInitialize(buffer_NetExposure, 0.0);
   ArrayInitialize(buffer_Weight, 0.0);
   ArrayInitialize(buffer_DirectionalWeight, 0.0);
   ArrayInitialize(buffer_WeightRank, 0.0);
   ArrayInitialize(buffer_ROEContribution, 0.0);
   ArrayInitialize(buffer_LeverageContribution, 0.0);
   ArrayInitialize(buffer_PendingBuyCount, 0.0);
   ArrayInitialize(buffer_PendingSellCount, 0.0);
   ArrayInitialize(buffer_TotalProfit, 0.0);
   ArrayInitialize(buffer_TPSLCautionROI, 0.0);
   ArrayInitialize(buffer_ROE_SL_Status, 0.0);
   ArrayInitialize(buffer_ROE_TP_Status, 0.0);
   ArrayInitialize(buffer_LeverageCaution, 0.0);
   ArrayInitialize(buffer_WeightClass, 0.0);
   ArrayInitialize(buffer_SymbolTotalExposure, 0.0);

// Initialize additional ROE buffers
   ArrayInitialize(buffer_PositiveNetProfitSwap, 0.0);
   ArrayInitialize(buffer_NegativeNetProfitSwap, 0.0);
   ArrayInitialize(buffer_AllocationProportion, 0.0);
   ArrayInitialize(buffer_LossCushionRatio, 0.0);
   ArrayInitialize(buffer_PrimaryLevelSL, 0.0);
   ArrayInitialize(buffer_ExtendedLevelSL, 0.0);
   ArrayInitialize(buffer_FirstLevelTP, 0.0);
   ArrayInitialize(buffer_SecondLevelTP, 0.0);
   ArrayInitialize(buffer_ThirdLevelTP, 0.0);

   return true;
  }

//+------------------------------------------------------------------+
//| Custom indicator iteration function                                |
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
   if(!ValidateROEBuffers())
     {
      Print("ROE buffer validation failed");
      return rates_total;
     }

   if(!ProcessAllSteps())
     {
      Print("Error processing calculation steps");
      return rates_total;
     }

   UpdateDisplay();
   return(rates_total);
  }

//+------------------------------------------------------------------+
//| Timer function                                                     |
//+------------------------------------------------------------------+
void OnTimer()
  {
   if(!ProcessAllSteps())
     {
      Print("Error processing steps in timer update");
      return;
     }

   UpdateDisplay();
  }

//+------------------------------------------------------------------+
//| Transform hierarchical data to flat buffers                        |
//+------------------------------------------------------------------+
void TransformToFlatBuffers()
  {
// Get the maximum size needed
   int maxSize = MathMax(ArraySize(g_FirstSplitData),
                         MathMax(ArraySize(g_SecondSplitData),
                                 ArraySize(g_ThirdSplitData)));

// Safety check
   if(maxSize <= 0)
     {
      Print("Warning: No data to transform in TransformToFlatBuffers");
      return;
     }

   Print("Transforming data with size: ", maxSize);

// Resize existing buffers
   ArrayResize(buffer_AbsoluteNetVolume, maxSize);
   ArrayResize(buffer_NetPosition, maxSize);
   ArrayResize(buffer_OpenPositions, maxSize);
   ArrayResize(buffer_PendingOrders, maxSize);
   ArrayResize(buffer_NetProfitSwap, maxSize);
   ArrayResize(buffer_TotalSwap, maxSize);
   ArrayResize(buffer_ROI, maxSize);
   ArrayResize(buffer_NetExposure, maxSize);
   ArrayResize(buffer_Weight, maxSize);
   ArrayResize(buffer_DirectionalWeight, maxSize);
   ArrayResize(buffer_WeightRank, maxSize);
   ArrayResize(buffer_ROEContribution, maxSize);
   ArrayResize(buffer_LeverageContribution, maxSize);
   ArrayResize(buffer_PendingBuyCount, maxSize);
   ArrayResize(buffer_PendingSellCount, maxSize);
   ArrayResize(buffer_TotalProfit, maxSize);
   ArrayResize(buffer_TPSLCautionROI, maxSize);
   ArrayResize(buffer_ROE_SL_Status, maxSize);
   ArrayResize(buffer_ROE_TP_Status, maxSize);
   ArrayResize(buffer_LeverageCaution, maxSize);
   ArrayResize(buffer_WeightClass, maxSize);
   ArrayResize(buffer_SymbolTotalExposure, maxSize);

// Resize additional ROE buffers
   ArrayResize(buffer_PositiveNetProfitSwap, maxSize);
   ArrayResize(buffer_NegativeNetProfitSwap, maxSize);
   ArrayResize(buffer_AllocationProportion, maxSize);
   ArrayResize(buffer_LossCushionRatio, maxSize);
   ArrayResize(buffer_PrimaryLevelSL, maxSize);
   ArrayResize(buffer_ExtendedLevelSL, maxSize);
   ArrayResize(buffer_FirstLevelTP, maxSize);
   ArrayResize(buffer_SecondLevelTP, maxSize);
   ArrayResize(buffer_ThirdLevelTP, maxSize);

// Initialize existing buffers
   ArrayInitialize(buffer_AbsoluteNetVolume, 0.0);
   ArrayInitialize(buffer_NetPosition, 0.0);
   ArrayInitialize(buffer_OpenPositions, 0.0);
   ArrayInitialize(buffer_PendingOrders, 0.0);
   ArrayInitialize(buffer_NetProfitSwap, 0.0);
   ArrayInitialize(buffer_TotalSwap, 0.0);
   ArrayInitialize(buffer_ROI, 0.0);
   ArrayInitialize(buffer_NetExposure, 0.0);
   ArrayInitialize(buffer_Weight, 0.0);
   ArrayInitialize(buffer_DirectionalWeight, 0.0);
   ArrayInitialize(buffer_WeightRank, 0.0);
   ArrayInitialize(buffer_ROEContribution, 0.0);
   ArrayInitialize(buffer_LeverageContribution, 0.0);
   ArrayInitialize(buffer_PendingBuyCount, 0.0);
   ArrayInitialize(buffer_PendingSellCount, 0.0);
   ArrayInitialize(buffer_TotalProfit, 0.0);
   ArrayInitialize(buffer_TPSLCautionROI, 0.0);
   ArrayInitialize(buffer_ROE_SL_Status, 0.0);
   ArrayInitialize(buffer_ROE_TP_Status, 0.0);
   ArrayInitialize(buffer_LeverageCaution, 0.0);
   ArrayInitialize(buffer_WeightClass, 0.0);
   ArrayInitialize(buffer_SymbolTotalExposure, 0.0);

// Initialize additional ROE buffers
   ArrayInitialize(buffer_PositiveNetProfitSwap, 0.0);
   ArrayInitialize(buffer_NegativeNetProfitSwap, 0.0);
   ArrayInitialize(buffer_AllocationProportion, 0.0);
   ArrayInitialize(buffer_LossCushionRatio, 0.0);
   ArrayInitialize(buffer_PrimaryLevelSL, 0.0);
   ArrayInitialize(buffer_ExtendedLevelSL, 0.0);
   ArrayInitialize(buffer_FirstLevelTP, 0.0);
   ArrayInitialize(buffer_SecondLevelTP, 0.0);
   ArrayInitialize(buffer_ThirdLevelTP, 0.0);

   double equity = AccountInfoDouble(ACCOUNT_EQUITY);

// Transform data
   for(int i = 0; i < maxSize; i++)
     {
      // FirstSplitData transformations (including ROE-related fields)
      if(i < ArraySize(g_FirstSplitData))
        {
         // Existing transformations
         buffer_AbsoluteNetVolume[i] = g_FirstSplitData[i].absoluteNetVolume;
         buffer_NetPosition[i] = (g_FirstSplitData[i].netPosition == "Net Long") ? 1.0 :
                                 (g_FirstSplitData[i].netPosition == "Net Short") ? -1.0 : 0.0;
         buffer_ROI[i] = g_FirstSplitData[i].roi;
         buffer_NetExposure[i] = g_FirstSplitData[i].netExposure;
         buffer_Weight[i] = g_FirstSplitData[i].weight;
         buffer_DirectionalWeight[i] = g_FirstSplitData[i].directionalWeight;
         buffer_WeightRank[i] = (double)g_FirstSplitData[i].weightRank;

         // ROE threshold transformations
         buffer_PrimaryLevelSL[i] = g_FirstSplitData[i].primaryLevelSL;
         buffer_ExtendedLevelSL[i] = g_FirstSplitData[i].extendedLevelSL;
         buffer_FirstLevelTP[i] = g_FirstSplitData[i].firstLevelTP;
         buffer_SecondLevelTP[i] = g_FirstSplitData[i].secondLevelTP;
         buffer_ThirdLevelTP[i] = g_FirstSplitData[i].thirdLevelTP;

         // Transform tpSLCautionRoi (1->5)
         buffer_TPSLCautionROI[i] =
            (g_FirstSplitData[i].tpSlCautionRoi == "TP Monitor") ? 1.0 :
            (g_FirstSplitData[i].tpSlCautionRoi == "SL Monitor") ? -1.0 :
            0.0;  // Neutral state

         // Transform leverageCaution (11->15)
         buffer_LeverageCaution[i] =
            (g_FirstSplitData[i].leverageCaution == "Over Leverage") ? 1.0 :
            (g_FirstSplitData[i].leverageCaution == "Under Leverage") ? -1.0 :
            0.0;  // Neutral state

         // Weight class transformation
         string weightClass = GetWeightClass(g_FirstSplitData[i].weight, ArraySize(g_FirstSplitData));
         buffer_WeightClass[i] =
            (weightClass == "Over-weight") ? 1.0 :
            (weightClass == "Under-weight") ? -1.0 :
            0.0;  // Balanced-weight
        }

      // SecondSplitData transformations (including ROE-related fields)
      if(i < ArraySize(g_SecondSplitData))
        {
         // Existing transformations
         buffer_NetProfitSwap[i] = g_SecondSplitData[i].netProfitSwap;
         buffer_TotalSwap[i] = g_SecondSplitData[i].totalSwap;
         buffer_TotalProfit[i] = g_SecondSplitData[i].totalProfit;

         // ROE data transformations
         buffer_PositiveNetProfitSwap[i] = g_SecondSplitData[i].positiveNetProfitSwap;
         buffer_NegativeNetProfitSwap[i] = g_SecondSplitData[i].negativeNetProfitSwap;
         buffer_AllocationProportion[i] = g_SecondSplitData[i].allocateProportion;
         buffer_LossCushionRatio[i] = g_SecondSplitData[i].lossCushionRatio;

         // ROE status transformations
         buffer_ROE_SL_Status[i] = (g_SecondSplitData[i].slNotification == "SL at Loss") ? -2.0 :
                                   (g_SecondSplitData[i].slNotification == "SL at Reduced Profit") ? -1.0 : 0.0;

         buffer_ROE_TP_Status[i] = (g_SecondSplitData[i].tpNotification == "Third TP Range") ? 3.0 :
                                   (g_SecondSplitData[i].tpNotification == "Second TP Range") ? 2.0 :
                                   (g_SecondSplitData[i].tpNotification == "First TP Range") ? 1.0 : 0.0;

         // Calculate ROE Contribution if equity is valid
         if(equity > 0)
           {
            buffer_ROEContribution[i] = (g_SecondSplitData[i].netProfitSwap /
                                         (equity - g_SecondSplitData[i].netProfitSwap)) * 100;
           }
        }

      // ThirdSplitData transformations
      if(i < ArraySize(g_ThirdSplitData))
        {
         buffer_OpenPositions[i] = (double)g_ThirdSplitData[i].openPositions;
         buffer_PendingOrders[i] = (double)g_ThirdSplitData[i].pendingOrders;
         buffer_PendingBuyCount[i] = (double)g_ThirdSplitData[i].pendingBuyCount;
         buffer_PendingSellCount[i] = (double)g_ThirdSplitData[i].pendingSellCount;
        }

      // Calculate Leverage Contribution
      if(equity > 0 && i < ArraySize(g_FirstSplitData))
        {
         buffer_LeverageContribution[i] = g_FirstSplitData[i].netExposure / equity;
        }

      // Calculate Symbol Total Exposure
      if(i < ArraySize(g_FirstSplitData))
        {
         double symbolTotalVolume = g_FirstSplitData[i].buyVolume + g_FirstSplitData[i].sellVolume;
         buffer_SymbolTotalExposure[i] = symbolTotalVolume *
                                         SymbolInfoDouble(g_FirstSplitData[i].symbol, SYMBOL_TRADE_CONTRACT_SIZE) *
                                         GetUSDConversionFactor(g_FirstSplitData[i].symbol);
        }
     }

   Print("Data transformation completed. Transformed size: ", maxSize);
   DebugPrintBuffers();
  }

//+------------------------------------------------------------------+
//| Helper Functions                                                   |
//+------------------------------------------------------------------+
// Helper function to convert numerical values to position strings
//--- Helper functions for reading from flat buffers
string GetNetPositionString(double value)
  {
   if(value == 1.0)
      return "Net Long";
   if(value == -1.0)
      return "Net Short";
   return "Flat";
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
string GetROESLString(double value)
  {
   switch((int)value)
     {
      case -2:
         return "SL at Loss";
      case -1:
         return "SL at Reduced Profit";
      default:
         return "---";
     }
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
string GetTPSLString(double value)
  {
   if(value == 1.0)
      return "TP Monitor";
   if(value == -1.0)
      return "SL Monitor";
   return "---";
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
string GetROETPString(double value)
  {
   switch((int)value)
     {
      case 3:
         return "Third TP Range";
      case 2:
         return "Second TP Range";
      case 1:
         return "First TP Range";
      default:
         return "---";
     }
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
string GetLeverageCautionString(double value)
  {
   if(value == 1.0)
      return "Over Leverage";
   if(value == -1.0)
      return "Under Leverage";
   return "Fair Leverage";
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
string GetWeightClassString(double value)
  {
   if(value == 1.0)
      return "Over-weight";
   if(value == -1.0)
      return "Under-weight";
   return "Balanced-weight";
  }

//+------------------------------------------------------------------+
//|  ROE Validation Function                                         |
//+------------------------------------------------------------------+
void ValidateROECalculations()
  {
   Print("\n=== VALIDATING ROE CALCULATIONS ===");

   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   if(equity <= 0)
     {
      Print("Warning: Invalid equity value for ROE calculations");
      return;
     }

// Validate risk-reward ratios
   Print("\nRisk-Reward Ratio Validation:");
   Print("First RR: ", FirstRiskRewardRatio);
   if(EnableSecondRR)
      Print("Second RR: ", SecondRiskRewardRatio);
   if(EnableThirdRR)
      Print("Third RR: ", ThirdRiskRewardRatio);

// Validate calculations for each symbol
   for(int i = 0; i < ArraySize(g_SecondSplitData); i++)
     {
      if(g_ThirdSplitData[i].openPositions > 0)
        {
         Print("\nValidating Symbol: ", g_SecondSplitData[i].symbol);

         // Check profit categorization
         if(g_SecondSplitData[i].netProfitSwap > 0 && g_SecondSplitData[i].negativeNetProfitSwap != 0)
            Print("Warning: Positive profit position has negative profit value");

         if(g_SecondSplitData[i].netProfitSwap < 0 && g_SecondSplitData[i].positiveNetProfitSwap != 0)
            Print("Warning: Negative profit position has positive profit value");

         // Check allocation proportion
         if(g_SecondSplitData[i].allocateProportion > 1.0 || g_SecondSplitData[i].allocateProportion < -1.0)
            Print("Warning: Allocation proportion out of range: ", g_SecondSplitData[i].allocateProportion);

         // Validate threshold sequence
         if(g_FirstSplitData[i].extendedLevelSL > g_FirstSplitData[i].primaryLevelSL)
            Print("Warning: Extended SL level is higher than primary SL level");

         if(g_FirstSplitData[i].firstLevelTP < g_FirstSplitData[i].primaryLevelSL * -1)
            Print("Warning: First TP level is lower than primary SL level inverse");
        }
     }

   Print("\n=== ROE VALIDATION COMPLETE ===");
  }

//+------------------------------------------------------------------+
//| Calculate Portfolio Level Metrics                                  |
//+------------------------------------------------------------------+
bool ProcessPortfolioCalculations()
  {
// Get account equity once for multiple calculations
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double netprofitafterswap = AccountInfoDouble(ACCOUNT_PROFIT);
   if(equity <= 0)
     {
      Print("Error: Invalid account equity");
      return false;
     }

// Reset all portfolio buffers
   buffer_Portfolio_AbsoluteNetVolume = 0;
   buffer_Portfolio_OpenPositions = 0;
   buffer_Portfolio_PendingOrders = 0;
   buffer_Portfolio_PendingBuyCount = 0;
   buffer_Portfolio_PendingSellCount = 0;
   buffer_Portfolio_NetProfitSwap = 0;
   buffer_Portfolio_TotalSwap = 0;
   buffer_Portfolio_TotalProfit = 0;
   buffer_Portfolio_TotalExposure = 0;
   buffer_Portfolio_NetExposure = 0;
   buffer_Portfolio_DirectionalWeight = 0;

// Calculate sums across all symbols
   for(int i = 0; i < ArraySize(g_FirstSplitData); i++)
     {
      buffer_Portfolio_AbsoluteNetVolume += buffer_AbsoluteNetVolume[i];
      buffer_Portfolio_OpenPositions += buffer_OpenPositions[i];
      buffer_Portfolio_PendingOrders += buffer_PendingOrders[i];
      buffer_Portfolio_PendingBuyCount += buffer_PendingBuyCount[i];
      buffer_Portfolio_PendingSellCount += buffer_PendingSellCount[i];
      buffer_Portfolio_NetProfitSwap += buffer_NetProfitSwap[i];
      buffer_Portfolio_TotalSwap += buffer_TotalSwap[i];
      buffer_Portfolio_TotalProfit += buffer_TotalProfit[i];
      buffer_Portfolio_TotalExposure += buffer_SymbolTotalExposure[i];
      buffer_Portfolio_NetExposure += buffer_NetExposure[i];
      buffer_Portfolio_DirectionalWeight += buffer_DirectionalWeight[i];
     }

// Calculate Portfolio Net Position (based on sum-product)
   double sumProduct = 0;
   for(int i = 0; i < ArraySize(g_FirstSplitData); i++)
     {
      sumProduct += (buffer_NetExposure[i] * (buffer_DirectionalWeight[i] / buffer_Weight[i]));
     }
   buffer_Portfolio_NetPosition = (sumProduct > 0) ? 1.0 : (sumProduct < 0) ? -1.0 : 0.0;

// Calculate Portfolio Leverage Contribution
   buffer_Portfolio_LeverageContribution = buffer_Portfolio_NetExposure / equity;

// Calculate Portfolio ROI
   if(buffer_Portfolio_TotalExposure > 0)
      buffer_Portfolio_ROI = (buffer_Portfolio_NetProfitSwap / (buffer_Portfolio_TotalExposure - netprofitafterswap)) * 100;

// Calculate Portfolio ROE Contribution
   buffer_Portfolio_ROEContribution = (buffer_Portfolio_NetProfitSwap / (equity - netprofitafterswap)) * 100;

// Set Portfolio TPSL Caution ROI
   if((buffer_Portfolio_NetProfitSwap / buffer_Portfolio_TotalExposure) * 100 > Portfolio_ROI_TP_Threshold)
      buffer_Portfolio_TPSLCautionROI = 1.0;  // TP Monitoring
   else
      if((buffer_Portfolio_NetProfitSwap / buffer_Portfolio_TotalExposure) * 100 < Portfolio_ROI_SL_Threshold)
         buffer_Portfolio_TPSLCautionROI = -1.0; // SL Monitoring
      else
         buffer_Portfolio_TPSLCautionROI = 0.0;  // Neutral

// Set Portfolio TPSL Caution ROE
   if(buffer_Portfolio_ROEContribution > Portfolio_ROE_TP_Threshold)
      buffer_Portfolio_TPSLCautionROE = 1.0;  // Take Profit
   else
      if(buffer_Portfolio_ROEContribution < Portfolio_ROE_SL_Threshold)
         buffer_Portfolio_TPSLCautionROE = -1.0; // Stop Loss
      else
         buffer_Portfolio_TPSLCautionROE = 0.0;  // Neutral
// Gross Leverage
   buffer_Portfolio_GrossLeverageContribution = buffer_Portfolio_TotalExposure / equity;

// Hedged Exposure
   buffer_Portfolio_HedgedExposure = buffer_Portfolio_TotalExposure - buffer_Portfolio_NetExposure;

// Hedged Percentage
   if(buffer_Portfolio_TotalExposure > 0)
      buffer_Portfolio_HedgedPercentage = (buffer_Portfolio_HedgedExposure / buffer_Portfolio_TotalExposure) * 100;
   else
      buffer_Portfolio_HedgedPercentage = 0;

// Calculate number of symbols with open positions
   int symbolCount = 0;  // Use local variable first
   for(int i = 0; i < ArraySize(g_FirstSplitData); i++)
     {
      if(buffer_OpenPositions[i] > 0)
         symbolCount++;
     }
   buffer_Portfolio_SymbolCount = symbolCount;  // Then assign to buffer

// Calculate standard deviation of leverage contribution
   if(symbolCount > 0)
      buffer_Portfolio_LeverageStdDev = CalculateLeverageStdDev(buffer_LeverageContribution, symbolCount);
   else
      buffer_Portfolio_LeverageStdDev = 0.0;

// Calculate Profit Factor
   if(MathAbs(buffer_Portfolio_SumNegativeProfits) > 0)
      buffer_Portfolio_ProfitFactor = buffer_Portfolio_SumPositiveProfits / MathAbs(buffer_Portfolio_SumNegativeProfits);
   else
      buffer_Portfolio_ProfitFactor = DBL_MAX;  // Use DBL_MAX to represent "---"

   return true;
  }

//+------------------------------------------------------------------+
//| Portfolio Status Helper Functions                                  |
//+------------------------------------------------------------------+
string GetPortfolioNetPositionStr(double value)
  {
   string netPosStr = "Flat";
   if(value == 1.0)
      netPosStr = "Net Long";
   else
      if(value == -1.0)
         netPosStr = "Net Short";
   return netPosStr;
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
string GetPortfolioTPSLROIStr(double value)
  {
   string tpslRoiStr = "---";
   if(value == 1.0)
      tpslRoiStr = "TP Monitor";
   else
      if(value == -1.0)
         tpslRoiStr = "SL Monitor";
   return tpslRoiStr;
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
string GetPortfolioTPSLROEStr(double value)
  {
   string tpslRoeStr = "---";
   if(value == 1.0)
      tpslRoeStr = "Take Profit";
   else
      if(value == -1.0)
         tpslRoeStr = "Stop Loss";
   return tpslRoeStr;
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
string GetPortfolioLeverageStr(double value)
  {
   string leverageStr = "Fair Leverage";
   if(value > Portfolio_Leverage_Upper)
      leverageStr = "Over Leverage";
   else
      if(value < Portfolio_Leverage_Lower)
         leverageStr = "Under Leverage";
   return leverageStr;
  }

//+------------------------------------------------------------------+
//| Calculate Risk Score for Leverage Contribution (X)                 |
//+------------------------------------------------------------------+
int GetLeverageScore(double x)
  {
   if(x < 0.25)
      return 1;
   if(x < 0.50)
      return 2;
   if(x < 0.75)
      return 3;
   if(x < 1.00)
      return 4;
   if(x < 1.25)
      return 5;
   if(x < 1.50)
      return 6;
   if(x < 1.75)
      return 7;
   if(x < 2.00)
      return 8;
   if(x < 2.50)
      return 9;
   return 10;
  }

//+------------------------------------------------------------------+
//| Get Leverage Notification                                          |
//+------------------------------------------------------------------+
string GetLeverageNotification(double x)
  {
   if(x < 0.25)
      return "Very conservative leverage";
   if(x < 0.50)
      return "Conservative leverage";
   if(x < 0.75)
      return "Balanced leverage";
   if(x < 1.00)
      return "Moderate leverage";
   if(x < 1.25)
      return "Above average leverage";
   if(x < 1.50)
      return "High leverage - careful monitoring needed";
   if(x < 1.75)
      return "Very high leverage - close monitoring required";
   if(x < 2.00)
      return "Excessive leverage - risk reduction recommended";
   if(x < 2.50)
      return "Dangerous leverage - immediate action needed";
   return "Critical leverage - urgent risk reduction required";
  }

//+------------------------------------------------------------------+
//| Calculate Risk Score for Symbol Count (Y)                         |
//+------------------------------------------------------------------+
int GetSymbolCountScore(int y)
  {
   if(y >= 10)
      return 1;
   if(y >= 8)
      return 2;
   if(y >= 6)
      return 4;
   if(y >= 4)
      return 6;
   if(y >= 2)
      return 8;
   return 10;
  }

//+------------------------------------------------------------------+
//| Get Symbol Count Notification                                      |
//+------------------------------------------------------------------+
string GetSymbolCountNotification(int y)
  {
   if(y >= 10)
      return "Well diversified";
   if(y >= 8)
      return "Good diversification";
   if(y >= 6)
      return "Moderate concentration";
   if(y >= 4)
      return "High concentration";
   if(y >= 2)
      return "Very high concentration";
   return "Extreme concentration";
  }

//+------------------------------------------------------------------+
//| Calculate Risk Score for Leverage StdDev (Z)                      |
//+------------------------------------------------------------------+
int GetLeverageStdDevScore(double z)
  {
   if(z < 0.05)
      return 1;
   if(z < 0.10)
      return 2;
   if(z < 0.15)
      return 3;
   if(z < 0.20)
      return 4;
   if(z < 0.25)
      return 5;
   if(z < 0.30)
      return 6;
   if(z < 0.35)
      return 7;
   if(z < 0.40)
      return 8;
   if(z < 0.45)
      return 9;
   return 10;
  }

//+------------------------------------------------------------------+
//| Get Leverage StdDev Notification                                   |
//+------------------------------------------------------------------+
string GetLeverageStdDevNotification(double z)
  {
   if(z < 0.05)
      return "Excellent balance across positions";
   if(z < 0.10)
      return "Well-balanced position sizes";
   if(z < 0.15)
      return "Good position size distribution";
   if(z < 0.20)
      return "Moderate position size variation";
   if(z < 0.25)
      return "Notable size differences between positions";
   if(z < 0.30)
      return "High variation in position sizes - review needed";
   if(z < 0.35)
      return "Very high position size disparity - rebalance recommended";
   if(z < 0.40)
      return "Excessive position size variation - immediate review needed";
   if(z < 0.45)
      return "Critical position size imbalance - urgent rebalancing needed";
   return "Extreme position size disparity - immediate action required";
  }

//+------------------------------------------------------------------+
//| Calculate Overall Risk Assessment                                  |
//+------------------------------------------------------------------+
void CalculateRiskAssessment()
  {
// Calculate individual scores
   int scoreX = GetLeverageScore(buffer_Portfolio_LeverageContribution);
   int scoreY = GetSymbolCountScore((int)buffer_Portfolio_SymbolCount);
   int scoreZ = GetLeverageStdDevScore(buffer_Portfolio_LeverageStdDev);

// Calculate weighted scores
   g_RiskAssessment.weightedScoreX = scoreX * 0.60;  // 60% weight
   g_RiskAssessment.weightedScoreY = scoreY * 0.15;  // 15% weight
   g_RiskAssessment.weightedScoreZ = scoreZ * 0.25;  // 25% weight

// Calculate total score
   g_RiskAssessment.totalScore = g_RiskAssessment.weightedScoreX +
                                 g_RiskAssessment.weightedScoreY +
                                 g_RiskAssessment.weightedScoreZ;

// Determine risk level
   if(g_RiskAssessment.totalScore > HighRiskThreshold)
      g_RiskAssessment.riskLevel = "High Risk";
   else
      if(g_RiskAssessment.totalScore > MediumHighThreshold)
         g_RiskAssessment.riskLevel = "Medium High";
      else
         if(g_RiskAssessment.totalScore > MediumLowThreshold)
            g_RiskAssessment.riskLevel = "Medium Low";
         else
            g_RiskAssessment.riskLevel = "Low Risk";

// Set notifications
   g_RiskAssessment.leverageNotification = GetLeverageNotification(buffer_Portfolio_LeverageContribution);
   g_RiskAssessment.symbolsNotification = GetSymbolCountNotification((int)buffer_Portfolio_SymbolCount);
   g_RiskAssessment.weightNotification = GetLeverageStdDevNotification(buffer_Portfolio_LeverageStdDev);
  }

//+------------------------------------------------------------------+
//| Process all calculation steps                                      |
//+------------------------------------------------------------------+
bool ProcessAllSteps()
  {
   if(!ProcessStep1_RawData())
      return false;
   if(!ProcessStep2_DirectionalGrouping())
      return false;
   if(!ProcessStep3_Netting())
      return false;
   if(!ProcessStep4_AbsoluteValues())
      return false;
   if(!ProcessStep5_Exposure())
      return false;
   if(!ProcessStep6_NonDirectionalWeight())
      return false;
   if(!ProcessStep7_BuySellAbsolute())
      return false;
   if(!ProcessStep8_CompareMagnitudes())
      return false;
   if(!ProcessStep9_DirectionalMultiply())
      return false;
   if(!ProcessStep11_NetDirectionalWeight())
      return false;
   if(!ProcessStep12_ProfitSwap())
      return false;
   if(!ProcessStep13_Counting())
      return false;

// Add new calculations
   if(!CalculateExtendedMetrics())
      return false;

// Add portfolio level calculations
   if(!ProcessPortfolioCalculations())
     {
      Print("Error processing portfolio calculations");
      return false;
     }

// Add this after ProcessPortfolioCalculations()
   CalculateRiskAssessment();

// Add ROE calculations in sequence
   ResetProfitSums();
   CalculateProfitSums();
   CalculateAllocationProportion();
   CalculateLossCushionRatio();

   if(ValidateAndCalculateSLThresholds())
     {
      if(ValidateRiskRewardRatios())
        {
         CalculateTPThresholds();
        }
     }

   SetROENotifications();

// Transform all data to flat buffers
   TransformToFlatBuffers();
   DebugPrintPortfolioCalculations();

   buffer_Portfolio_SumPositiveProfits = SumPositiveProfits();
   buffer_Portfolio_SumNegativeProfits = SumNegativeProfits();

   return true;
  }

//+------------------------------------------------------------------+
//| Deinitialization function                                         |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
// Existing deinit code...

   Print("\n=== FINAL ROE STATUS AT DEINIT ===");
   ValidateROECalculations();
   DebugPrintBuffers();
   DebugPrintPortfolioCalculations();
   EventKillTimer();
   ObjectsDeleteAll(0);
   ChartRedraw();
  }

//+------------------------------------------------------------------+
//| Debug Print Function                                               |
//+------------------------------------------------------------------+
void DebugPrintBuffers()
  {
   int maxSize = MathMax(ArraySize(g_FirstSplitData),
                         MathMax(ArraySize(g_SecondSplitData),
                                 ArraySize(g_ThirdSplitData)));

   Print("=== DEBUG BUFFER VALUES START ===");
   Print("Maximum Array Size: ", maxSize);

   Print("\nROE Input Parameters:");
   Print("First Risk-Reward ratio: ", DoubleToString(FirstRiskRewardRatio, 8));
   Print("Second Risk-Reward ratio: ", DoubleToString(SecondRiskRewardRatio, 8));
   Print("Third Risk-Reward ratio: ", DoubleToString(ThirdRiskRewardRatio, 8));
   Print("Second RR Enabled: ", EnableSecondRR);
   Print("Third RR Enabled: ", EnableThirdRR);

   for(int i = 0; i < maxSize; i++)
     {
      string symbol = (i < ArraySize(g_FirstSplitData)) ? g_FirstSplitData[i].symbol : "Unknown";
      Print("\n=== Index ", i, " (Symbol: ", symbol, ") ===");

      // Calculate additional cushion for this symbol
      double additionalCushion = 0;
      if(i < ArraySize(g_SecondSplitData) && g_ThirdSplitData[i].openPositions > 0)
        {
         for(int j = 0; j < ArraySize(g_SecondSplitData); j++)
           {
            if(j != i && g_SecondSplitData[j].positiveNetProfitSwap > 0)
              {
               additionalCushion += g_SecondSplitData[j].positiveNetProfitSwap * g_SecondSplitData[i].allocateProportion;
              }
           }
        }
      Print("Additional Cushion: ", DoubleToString(additionalCushion, 8), " ", AccountInfoString(ACCOUNT_CURRENCY));

      // Original Buffers
      if(i < ArraySize(buffer_AbsoluteNetVolume))
         Print("AbsoluteNetVolume: ", DoubleToString(buffer_AbsoluteNetVolume[i], 8));

      if(i < ArraySize(buffer_NetPosition))
         Print("NetPosition: ", GetNetPositionString(buffer_NetPosition[i]));

      if(i < ArraySize(buffer_OpenPositions))
         Print("OpenPositions: ", DoubleToString(buffer_OpenPositions[i], 8));

      if(i < ArraySize(buffer_PendingOrders))
         Print("PendingOrders: ", DoubleToString(buffer_PendingOrders[i], 8));

      if(i < ArraySize(buffer_NetProfitSwap))
         Print("Profit net Swap: ", DoubleToString(buffer_NetProfitSwap[i], 8), " ", AccountInfoString(ACCOUNT_CURRENCY));

      if(i < ArraySize(buffer_TotalSwap))
         Print("TotalSwap: ", DoubleToString(buffer_TotalSwap[i], 8), " ", AccountInfoString(ACCOUNT_CURRENCY));

      if(i < ArraySize(buffer_TotalProfit))
         Print("Profit ex Swap: ", DoubleToString(buffer_TotalProfit[i], 8), " ", AccountInfoString(ACCOUNT_CURRENCY));

      if(i < ArraySize(buffer_ROI))
         Print("ROIContribution: ", DoubleToString(buffer_ROI[i], 8), "%");

      if(i < ArraySize(buffer_NetExposure))
         Print("NetExposure: ", DoubleToString(buffer_NetExposure[i], 8), " USD");  // Keep USD as it's always in USD

      if(i < ArraySize(buffer_Weight))
         Print("Weight: ", DoubleToString(buffer_Weight[i], 8), "%");

      if(i < ArraySize(buffer_DirectionalWeight))
         Print("DirectionalWeight: ", DoubleToString(buffer_DirectionalWeight[i], 8), "%");

      if(i < ArraySize(buffer_WeightRank))
         Print("WeightRank: ", DoubleToString(buffer_WeightRank[i], 8));

      if(i < ArraySize(buffer_ROEContribution))
         Print("ROEContribution: ", DoubleToString(buffer_ROEContribution[i], 8), "%");

      if(i < ArraySize(buffer_LeverageContribution))
         Print("LeverageContribution: ", DoubleToString(buffer_LeverageContribution[i], 8), "x");

      if(i < ArraySize(buffer_PendingBuyCount))
         Print("PendingBuyCount: ", DoubleToString(buffer_PendingBuyCount[i], 8));

      if(i < ArraySize(buffer_PendingSellCount))
         Print("PendingSellCount: ", DoubleToString(buffer_PendingSellCount[i], 8));

      if(i < ArraySize(buffer_TPSLCautionROI))
         Print("TPSLCautionROI: ", GetTPSLString(buffer_TPSLCautionROI[i]));

      if(i < ArraySize(buffer_LeverageCaution))
         Print("LeverageCaution: ", GetLeverageCautionString(buffer_LeverageCaution[i]));

      if(i < ArraySize(buffer_WeightClass))
         Print("WeightClass: ", GetWeightClassString(buffer_WeightClass[i]));

      if(i < ArraySize(buffer_SymbolTotalExposure))
         Print("SymbolTotalExposure: ", DoubleToString(buffer_SymbolTotalExposure[i], 8), " USD");  // Keep USD as it's always in USD

      // ROE Intermediate Calculations
      if(i < ArraySize(buffer_PositiveNetProfitSwap))
         Print("PositiveNetProfitSwap: ", DoubleToString(buffer_PositiveNetProfitSwap[i], 8), " ", AccountInfoString(ACCOUNT_CURRENCY));

      if(i < ArraySize(buffer_NegativeNetProfitSwap))
         Print("NegativeNetProfitSwap: ", DoubleToString(buffer_NegativeNetProfitSwap[i], 8), " ", AccountInfoString(ACCOUNT_CURRENCY));

      if(i < ArraySize(buffer_AllocationProportion))
         Print("AllocationProportion: ", DoubleToString(buffer_AllocationProportion[i], 8));

      if(i < ArraySize(buffer_LossCushionRatio))
         Print("LossCushionRatio: ", DoubleToString(buffer_LossCushionRatio[i], 8), "%");

      // ROE Thresholds
      if(i < ArraySize(buffer_PrimaryLevelSL))
         Print("PrimaryLevelSL: ", DoubleToString(buffer_PrimaryLevelSL[i], 8), "%");

      if(i < ArraySize(buffer_ExtendedLevelSL))
         Print("ExtendedLevelSL: ", DoubleToString(buffer_ExtendedLevelSL[i], 8), "%");

      if(i < ArraySize(buffer_FirstLevelTP))
         Print("FirstLevelTP: ", DoubleToString(buffer_FirstLevelTP[i], 8), "%");

      if(i < ArraySize(buffer_SecondLevelTP))
         Print("SecondLevelTP: ", DoubleToString(buffer_SecondLevelTP[i], 8), "%");

      if(i < ArraySize(buffer_ThirdLevelTP))
         Print("ThirdLevelTP: ", DoubleToString(buffer_ThirdLevelTP[i], 8), "%");

      // ROE Status
      if(i < ArraySize(buffer_ROE_SL_Status))
         Print("ROE SL Status: ", GetROESLString(buffer_ROE_SL_Status[i]));

      if(i < ArraySize(buffer_ROE_TP_Status))
         Print("ROE TP Status: ", GetROETPString(buffer_ROE_TP_Status[i]));

      // Leverage StdDev Info
      if(buffer_OpenPositions[i] > 0)
        {
         Print("Symbol included in Leverage StdDev calculation (has open positions)");
         Print("Individual Leverage Contribution used in StdDev: ",
               DoubleToString(buffer_LeverageContribution[i], 8), "x");
        }
      else
        {
         Print("Symbol excluded from Leverage StdDev calculation (no open positions)");
        }
     }

   Print("=== DEBUG BUFFER VALUES END ===");
  }

//+------------------------------------------------------------------+
//| Debug Print Portfolio Calculations                                 |
//+------------------------------------------------------------------+
void DebugPrintPortfolioCalculations()
  {
   Print("\n=== PORTFOLIO LEVEL CALCULATIONS DEBUG START ===");

// Input Parameters Section
   Print("\n--- Input Thresholds ---");
   Print("Portfolio TP Monitoring Threshold: ", Portfolio_ROI_TP_Threshold, "%");
   Print("Portfolio SL Monitoring Threshold: ", Portfolio_ROI_SL_Threshold, "%");
   Print("Portfolio ROE TP Threshold: ", Portfolio_ROE_TP_Threshold, "%");
   Print("Portfolio ROE SL Threshold: ", Portfolio_ROE_SL_Threshold, "%");
   Print("Portfolio Leverage Upper Threshold: ", Portfolio_Leverage_Upper, "x");
   Print("Portfolio Leverage Lower Threshold: ", Portfolio_Leverage_Lower, "x");

   Print("\n--- Account Information ---");
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   Print("Account Equity: ", DoubleToString(equity, 2), " ", AccountInfoString(ACCOUNT_CURRENCY));

   Print("\n--- Intermediate Calculations ---");
   Print("Portfolio Absolute Net Volume (Sum): ", DoubleToString(buffer_Portfolio_AbsoluteNetVolume, 2));
   Print("Portfolio Open Positions (Sum): ", DoubleToString(buffer_Portfolio_OpenPositions, 0));
   Print("Portfolio Pending Orders (Sum): ", DoubleToString(buffer_Portfolio_PendingOrders, 0));
   Print("Portfolio Pending Buy Count (Sum): ", DoubleToString(buffer_Portfolio_PendingBuyCount, 0));
   Print("Portfolio Pending Sell Count (Sum): ", DoubleToString(buffer_Portfolio_PendingSellCount, 0));
   Print("Portfolio Profit net Swap (Sum): ", DoubleToString(buffer_Portfolio_NetProfitSwap, 2), " ", AccountInfoString(ACCOUNT_CURRENCY));
   Print("Portfolio Swap (Sum): ", DoubleToString(buffer_Portfolio_TotalSwap, 2), " ", AccountInfoString(ACCOUNT_CURRENCY));
   Print("Portfolio Profit ex Swap (Sum): ", DoubleToString(buffer_Portfolio_TotalProfit, 2), " ", AccountInfoString(ACCOUNT_CURRENCY));
   Print("Portfolio Exposure (Sum): ", DoubleToString(buffer_Portfolio_TotalExposure, 2)); // Keep USD as it's always
   Print("Portfolio Net Exposure (Sum): ", DoubleToString(buffer_Portfolio_NetExposure, 2)); // Keep USD as it's always
   Print("Portfolio Hedged Exposure: ", DoubleToString(buffer_Portfolio_HedgedExposure, 2), " USD"); // Keep USD as it's always
   Print("Portfolio Hedged Percentage: ", DoubleToString(buffer_Portfolio_HedgedPercentage, 2), "%");
   Print("Portfolio Directional Weight (Sum): ", DoubleToString(buffer_Portfolio_DirectionalWeight, 2), "%");
   Print("Sum of Positive Profits: ", DoubleToString(buffer_Portfolio_SumPositiveProfits, 2), " ", AccountInfoString(ACCOUNT_CURRENCY));
   Print("Sum of Negative Profits: ", DoubleToString(buffer_Portfolio_SumNegativeProfits, 2), " ", AccountInfoString(ACCOUNT_CURRENCY));

   Print("\n--- Portfolio Level Metrics ---");
   Print("Portfolio Number of Active Symbols (with open positions): ", DoubleToString(buffer_Portfolio_SymbolCount, 0));
   Print("Portfolio Net Position: ", GetPortfolioNetPositionStr(buffer_Portfolio_NetPosition));
   Print("Portfolio Gross Leverage: ", DoubleToString(buffer_Portfolio_GrossLeverageContribution, 4), "x");
   Print("Portfolio Net Leverage : ", DoubleToString(buffer_Portfolio_LeverageContribution, 4), "x");
   Print("Portfolio ROI Contribution: ", DoubleToString(buffer_Portfolio_ROI, 4), "%");
   Print("Portfolio ROE Contribution: ", DoubleToString(buffer_Portfolio_ROEContribution, 4), "%");
   Print("Portfolio TPSL Caution ROI: ", GetPortfolioTPSLROIStr(buffer_Portfolio_TPSLCautionROI));
   Print("Portfolio TPSL Caution ROE: ", GetPortfolioTPSLROEStr(buffer_Portfolio_TPSLCautionROE));
   Print("Portfolio Leverage Status: ", GetPortfolioLeverageStr(buffer_Portfolio_LeverageContribution));
   Print("Portfolio StdDev of Leverage Contribution: ", DoubleToString(buffer_Portfolio_LeverageStdDev, 4), "x");
   if(buffer_Portfolio_ProfitFactor == DBL_MAX)
      Print("Portfolio Profit Factor: ---");
   else
      Print("Portfolio Profit Factor: ", DoubleToString(buffer_Portfolio_ProfitFactor, 4));

   Print("\n=== PORTFOLIO LEVEL CALCULATIONS DEBUG END ===");

   Print("\n=== RISK ASSESSMENT RESULTS ===");
   Print("Individual Scores:");
   Print("Leverage Contribution Score (60%): ", DoubleToString(g_RiskAssessment.weightedScoreX, 2));
   Print("Symbol Count Score (15%): ", DoubleToString(g_RiskAssessment.weightedScoreY, 2));
   Print("Leverage StdDev Score (25%): ", DoubleToString(g_RiskAssessment.weightedScoreZ, 2));
   Print("\nTotal Risk Score (0-10): ", DoubleToString(g_RiskAssessment.totalScore, 2));
   Print("Overall Risk Level: ", g_RiskAssessment.riskLevel);

   Print("\n=== TRADER NOTIFICATIONS ===");
   Print("Net Portfolio Leverage: ", g_RiskAssessment.leverageNotification);
   Print("Portfolio Diversification: ", g_RiskAssessment.symbolsNotification);
   Print("Position Size Balance: ", g_RiskAssessment.weightNotification);

   Print("\n=== END OF PORTFOLIO CALCULATIONS AND RISK ASSESSMENT ===");
  }
//+------------------------------------------------------------------+
