//+------------------------------------------------------------------+
//|                                                       strcpy.mqh |
//|                                      Copyright 2006-2014         |
//+------------------------------------------------------------------+
#property copyright "Copyright © 2006-2014"
#property version   "1.00"

#import "msvcrt.dll"
int strcpy(uchar &Destination[],const int Source);
int strcpy(uchar &Destination[],const long Source);
#import

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
int strcpy(uchar &Destination[],const long Source)
{
   if(_IsX64)
      return(msvcrt::strcpy(Destination,Source));
   else
      return(msvcrt::strcpy(Destination,(int)Source));
}
//+------------------------------------------------------------------+
