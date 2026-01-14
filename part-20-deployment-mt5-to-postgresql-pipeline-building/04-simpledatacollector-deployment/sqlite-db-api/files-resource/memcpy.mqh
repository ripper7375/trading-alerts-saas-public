//+------------------------------------------------------------------+
//|                                                       memcpy.mqh |
//|                                      Copyright 2006-2014         |
//+------------------------------------------------------------------+
#property copyright "Copyright © 2006-2014"
#property version   "1.00"

#import "msvcrt.dll"
int memcpy(uchar &Destination[],const int Source,int Length);
long memcpy(uchar &Destination[],const long Source,int Length);

int memcpy(int &Destination[],const int Source,int Length);
int memcpy(long &Destination[],const long Source,int Length);

int memcpy(uchar &Destination[],uchar &Source[],int Length);

int memcpy(int &Destination,int &Source,int Length);
long memcpy(long &Destination,long &Source,int Length);
#import

//+------------------------------------------------------------------+
//| memcpy                                                           |
//+------------------------------------------------------------------+
long memcpy(long &Destination[],long Source,int Length)
{
   if(_IsX64)
      return(msvcrt::memcpy(Destination, Source, Length));
   else
   {
      int d[];
      int sz=ArraySize(Destination);
      ArrayResize(d,sz);
      int s=(int)Source;
      int r=msvcrt::memcpy(d,s,Length);
      for(int i=0; i<sz; i++)
         Destination[i]=d[i];
      Source=s;
      return(r);
   }
}

//+------------------------------------------------------------------+
//| memcpy                                                           |
//+------------------------------------------------------------------+
long memcpy(long &Destination,long Source,int Length)
{
   if(_IsX64)
      return(msvcrt::memcpy(Destination, Source, Length));
   else
   {
      int d=(int)Destination;
      int s=(int)Source;
      int r=msvcrt::memcpy(d,s,Length);
      Destination=d;
      Source=s;
      return(r);
   }
}

//+------------------------------------------------------------------+
//| memcpy                                                           |
//+------------------------------------------------------------------+
long memcpy(uchar &Destination[],long &Source,int Length)
{
   if(_IsX64)
      return(msvcrt::memcpy(Destination, Source, Length));
   else
   {
      int s=(int)Source;
      int r=msvcrt::memcpy(Destination,s,Length);
      Source=s;
      return(r);
   }
}
//+------------------------------------------------------------------+
