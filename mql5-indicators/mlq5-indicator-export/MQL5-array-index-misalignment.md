This is a classic MQL5 array indexing problem:

time_array from CopyTime() has index [0] = oldest bar
But indicator buffers set with ArraySetAsSeries(..., true) have index [0] = newest bar (not oldest bar)
