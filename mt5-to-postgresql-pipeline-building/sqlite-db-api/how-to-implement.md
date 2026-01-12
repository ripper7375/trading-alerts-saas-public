Installation Instructions

Let's install all these files in the correct directory structure on your Contabo VPS.

Step 1: Create Directory Structure

On Contabo, create these folders:

C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\492CD01931BD0D07A159AEF5B29BF32C\MQL5\Include\SQLite3\

C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\492CD01931BD0D07A159AEF5B29BF32C\MQL5\Include\MQH\Ctrl\

C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\492CD01931BD0D07A159AEF5B29BF32C\MQL5\Include\MQH\Lib\WinApi\msvcrt\

C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\492CD01931BD0D07A159AEF5B29BF32C\MQL5\Libraries\

Step 2: Place Files in Correct Locations

SQLite3 folder (...\MQL5\Include\SQLite3\):

SQLite3Base.mqh
SQLite3Define.mqh
SQLite3Import.mqh

MQH\Ctrl folder (...\MQL5\Include\MQH\Ctrl\):

ByteImg.mqh

MQH\Lib\WinApi\msvcrt folder (...\MQL5\Include\MQH\Lib\WinApi\msvcrt\):

memcpy.mqh
strlen.mqh
strcpy.mqh

Libraries folder (...\MQL5\Libraries\):

sqlite3_32.dll
sqlite3_64.dll

After Installation

Once all files are in place, we'll:

Create the simplified OHLC collector using SQLite
Compile SimpleDataCollector.mq5 and test it
Verify data is being written to SQLite
Test the sync script to Railway
