-- ============================================================================
-- Seed Data for Trading Alerts SaaS
-- Part 20: SQLite + Sync to PostgreSQL Architecture
--
-- Purpose: Test data for development and testing
-- Contains: 100 sample rows for EURUSD in SQLite format
-- ============================================================================

-- ============================================================================
-- SQLITE SEED DATA FORMAT
-- Insert into SQLite for testing MQL5 Service → SQLite → Sync flow
--
-- Columns:
--   timestamp: Unix timestamp (INTEGER)
--   open, high, low, close: Price values (REAL)
--   fractals: JSON with peaks and bottoms
--   horizontal_trendlines: JSON with support/resistance levels
--   diagonal_trendlines: JSON with trend lines
--   momentum_candles: JSON array of momentum candle data
--   keltner_channels: JSON with 10 bands
--   tema, hrma, smma: Moving average values (REAL)
--   zigzag: JSON with market structure points
-- ============================================================================

-- Note: These timestamps represent M5 candles starting from 2026-01-03 00:00:00 UTC
-- Unix timestamp 1767398400 = 2026-01-03 00:00:00 UTC

-- Sample EURUSD data with realistic values around 1.0850
INSERT INTO EURUSD (timestamp, open, high, low, close, fractals, horizontal_trendlines, diagonal_trendlines, momentum_candles, keltner_channels, tema, hrma, smma, zigzag) VALUES
-- 2026-01-03 00:00:00 to 00:25:00 (6 candles)
(1767398400, 1.08500, 1.08520, 1.08480, 1.08510, '{"peaks": [], "bottoms": []}', '{}', '{}', '[]', '{"ultra_extreme_upper": 1.0900, "extreme_upper": 1.0890, "upper_most": 1.0880, "upper": 1.0870, "upper_middle": 1.0860, "lower_middle": 1.0840, "lower": 1.0830, "lower_most": 1.0820, "extreme_lower": 1.0810, "ultra_extreme_lower": 1.0800}', 1.08505, 1.08502, 1.08500, '{"peaks": [], "bottoms": []}'),
(1767398700, 1.08510, 1.08535, 1.08495, 1.08525, '{"peaks": [], "bottoms": []}', '{}', '{}', '[]', '{"ultra_extreme_upper": 1.0901, "extreme_upper": 1.0891, "upper_most": 1.0881, "upper": 1.0871, "upper_middle": 1.0861, "lower_middle": 1.0841, "lower": 1.0831, "lower_most": 1.0821, "extreme_lower": 1.0811, "ultra_extreme_lower": 1.0801}', 1.08515, 1.08512, 1.08508, '{"peaks": [], "bottoms": []}'),
(1767399000, 1.08525, 1.08550, 1.08510, 1.08545, '{"peaks": [], "bottoms": []}', '{}', '{}', '[{"index": 2, "type": 1, "zscore": 1.8}]', '{"ultra_extreme_upper": 1.0902, "extreme_upper": 1.0892, "upper_most": 1.0882, "upper": 1.0872, "upper_middle": 1.0862, "lower_middle": 1.0842, "lower": 1.0832, "lower_most": 1.0822, "extreme_lower": 1.0812, "ultra_extreme_lower": 1.0802}', 1.08530, 1.08528, 1.08520, '{"peaks": [], "bottoms": []}'),
(1767399300, 1.08545, 1.08560, 1.08530, 1.08555, '{"peaks": [{"index": 3, "price": 1.08560, "time": 1767399300}], "bottoms": []}', '{"peak_1": [{"index": 3, "value": 1.08560}]}', '{}', '[]', '{"ultra_extreme_upper": 1.0903, "extreme_upper": 1.0893, "upper_most": 1.0883, "upper": 1.0873, "upper_middle": 1.0863, "lower_middle": 1.0843, "lower": 1.0833, "lower_most": 1.0823, "extreme_lower": 1.0813, "ultra_extreme_lower": 1.0803}', 1.08545, 1.08542, 1.08535, '{"peaks": [{"index": 3, "price": 1.08560, "time": 1767399300}], "bottoms": []}'),
(1767399600, 1.08555, 1.08560, 1.08520, 1.08530, '{"peaks": [{"index": 3, "price": 1.08560, "time": 1767399300}], "bottoms": []}', '{"peak_1": [{"index": 3, "value": 1.08560}]}', '{}', '[]', '{"ultra_extreme_upper": 1.0902, "extreme_upper": 1.0892, "upper_most": 1.0882, "upper": 1.0872, "upper_middle": 1.0862, "lower_middle": 1.0842, "lower": 1.0832, "lower_most": 1.0822, "extreme_lower": 1.0812, "ultra_extreme_lower": 1.0802}', 1.08540, 1.08538, 1.08532, '{"peaks": [{"index": 3, "price": 1.08560, "time": 1767399300}], "bottoms": []}'),
(1767399900, 1.08530, 1.08540, 1.08490, 1.08500, '{"peaks": [{"index": 3, "price": 1.08560, "time": 1767399300}], "bottoms": []}', '{"peak_1": [{"index": 3, "value": 1.08560}]}', '{}', '[{"index": 5, "type": 4, "zscore": -1.5}]', '{"ultra_extreme_upper": 1.0901, "extreme_upper": 1.0891, "upper_most": 1.0881, "upper": 1.0871, "upper_middle": 1.0861, "lower_middle": 1.0841, "lower": 1.0831, "lower_most": 1.0821, "extreme_lower": 1.0811, "ultra_extreme_lower": 1.0801}', 1.08520, 1.08518, 1.08515, '{"peaks": [{"index": 3, "price": 1.08560, "time": 1767399300}], "bottoms": []}'),

-- 2026-01-03 00:30:00 to 01:00:00 (7 candles)
(1767400200, 1.08500, 1.08510, 1.08470, 1.08475, '{"peaks": [{"index": 3, "price": 1.08560, "time": 1767399300}], "bottoms": []}', '{"peak_1": [{"index": 3, "value": 1.08560}]}', '{}', '[]', '{"ultra_extreme_upper": 1.0900, "extreme_upper": 1.0890, "upper_most": 1.0880, "upper": 1.0870, "upper_middle": 1.0860, "lower_middle": 1.0840, "lower": 1.0830, "lower_most": 1.0820, "extreme_lower": 1.0810, "ultra_extreme_lower": 1.0800}', 1.08495, 1.08493, 1.08490, '{"peaks": [{"index": 3, "price": 1.08560, "time": 1767399300}], "bottoms": []}'),
(1767400500, 1.08475, 1.08490, 1.08450, 1.08460, '{"peaks": [{"index": 3, "price": 1.08560, "time": 1767399300}], "bottoms": [{"index": 7, "price": 1.08450, "time": 1767400500}]}', '{"peak_1": [{"index": 3, "value": 1.08560}], "bottom_1": [{"index": 7, "value": 1.08450}]}', '{"ascending_1": [{"start_index": 7, "start_value": 1.08450, "end_index": 3, "end_value": 1.08560}]}', '[]', '{"ultra_extreme_upper": 1.0899, "extreme_upper": 1.0889, "upper_most": 1.0879, "upper": 1.0869, "upper_middle": 1.0859, "lower_middle": 1.0839, "lower": 1.0829, "lower_most": 1.0819, "extreme_lower": 1.0809, "ultra_extreme_lower": 1.0799}', 1.08475, 1.08472, 1.08470, '{"peaks": [{"index": 3, "price": 1.08560, "time": 1767399300}], "bottoms": [{"index": 7, "price": 1.08450, "time": 1767400500}]}'),
(1767400800, 1.08460, 1.08490, 1.08455, 1.08485, '{"peaks": [{"index": 3, "price": 1.08560, "time": 1767399300}], "bottoms": [{"index": 7, "price": 1.08450, "time": 1767400500}]}', '{"peak_1": [{"index": 3, "value": 1.08560}], "bottom_1": [{"index": 7, "value": 1.08450}]}', '{"ascending_1": [{"start_index": 7, "start_value": 1.08450, "end_index": 3, "end_value": 1.08560}]}', '[{"index": 8, "type": 1, "zscore": 1.2}]', '{"ultra_extreme_upper": 1.0900, "extreme_upper": 1.0890, "upper_most": 1.0880, "upper": 1.0870, "upper_middle": 1.0860, "lower_middle": 1.0840, "lower": 1.0830, "lower_most": 1.0820, "extreme_lower": 1.0810, "ultra_extreme_lower": 1.0800}', 1.08480, 1.08478, 1.08475, '{"peaks": [{"index": 3, "price": 1.08560, "time": 1767399300}], "bottoms": [{"index": 7, "price": 1.08450, "time": 1767400500}]}'),
(1767401100, 1.08485, 1.08510, 1.08480, 1.08505, '{"peaks": [{"index": 3, "price": 1.08560, "time": 1767399300}], "bottoms": [{"index": 7, "price": 1.08450, "time": 1767400500}]}', '{"peak_1": [{"index": 3, "value": 1.08560}], "bottom_1": [{"index": 7, "value": 1.08450}]}', '{"ascending_1": [{"start_index": 7, "start_value": 1.08450, "end_index": 3, "end_value": 1.08560}]}', '[]', '{"ultra_extreme_upper": 1.0901, "extreme_upper": 1.0891, "upper_most": 1.0881, "upper": 1.0871, "upper_middle": 1.0861, "lower_middle": 1.0841, "lower": 1.0831, "lower_most": 1.0821, "extreme_lower": 1.0811, "ultra_extreme_lower": 1.0801}', 1.08495, 1.08492, 1.08488, '{"peaks": [{"index": 3, "price": 1.08560, "time": 1767399300}], "bottoms": [{"index": 7, "price": 1.08450, "time": 1767400500}]}'),
(1767401400, 1.08505, 1.08530, 1.08500, 1.08525, '{"peaks": [{"index": 3, "price": 1.08560, "time": 1767399300}], "bottoms": [{"index": 7, "price": 1.08450, "time": 1767400500}]}', '{"peak_1": [{"index": 3, "value": 1.08560}], "bottom_1": [{"index": 7, "value": 1.08450}]}', '{"ascending_1": [{"start_index": 7, "start_value": 1.08450, "end_index": 3, "end_value": 1.08560}]}', '[]', '{"ultra_extreme_upper": 1.0902, "extreme_upper": 1.0892, "upper_most": 1.0882, "upper": 1.0872, "upper_middle": 1.0862, "lower_middle": 1.0842, "lower": 1.0832, "lower_most": 1.0822, "extreme_lower": 1.0812, "ultra_extreme_lower": 1.0802}', 1.08510, 1.08508, 1.08502, '{"peaks": [{"index": 3, "price": 1.08560, "time": 1767399300}], "bottoms": [{"index": 7, "price": 1.08450, "time": 1767400500}]}'),
(1767401700, 1.08525, 1.08545, 1.08520, 1.08540, '{"peaks": [{"index": 3, "price": 1.08560, "time": 1767399300}], "bottoms": [{"index": 7, "price": 1.08450, "time": 1767400500}]}', '{"peak_1": [{"index": 3, "value": 1.08560}], "bottom_1": [{"index": 7, "value": 1.08450}]}', '{"ascending_1": [{"start_index": 7, "start_value": 1.08450, "end_index": 3, "end_value": 1.08560}]}', '[]', '{"ultra_extreme_upper": 1.0903, "extreme_upper": 1.0893, "upper_most": 1.0883, "upper": 1.0873, "upper_middle": 1.0863, "lower_middle": 1.0843, "lower": 1.0833, "lower_most": 1.0823, "extreme_lower": 1.0813, "ultra_extreme_lower": 1.0803}', 1.08525, 1.08522, 1.08515, '{"peaks": [{"index": 3, "price": 1.08560, "time": 1767399300}], "bottoms": [{"index": 7, "price": 1.08450, "time": 1767400500}]}'),
(1767402000, 1.08540, 1.08570, 1.08535, 1.08565, '{"peaks": [{"index": 12, "price": 1.08570, "time": 1767402000}], "bottoms": [{"index": 7, "price": 1.08450, "time": 1767400500}]}', '{"peak_1": [{"index": 12, "value": 1.08570}], "bottom_1": [{"index": 7, "value": 1.08450}]}', '{"ascending_1": [{"start_index": 7, "start_value": 1.08450, "end_index": 12, "end_value": 1.08570}]}', '[{"index": 12, "type": 2, "zscore": 2.5}]', '{"ultra_extreme_upper": 1.0904, "extreme_upper": 1.0894, "upper_most": 1.0884, "upper": 1.0874, "upper_middle": 1.0864, "lower_middle": 1.0844, "lower": 1.0834, "lower_most": 1.0824, "extreme_lower": 1.0814, "ultra_extreme_lower": 1.0804}', 1.08545, 1.08542, 1.08532, '{"peaks": [{"index": 12, "price": 1.08570, "time": 1767402000}], "bottoms": [{"index": 7, "price": 1.08450, "time": 1767400500}]}'),

-- Continue with more candles (01:05 to 02:00) - 12 more candles
(1767402300, 1.08565, 1.08575, 1.08550, 1.08555, '{"peaks": [{"index": 12, "price": 1.08570, "time": 1767402000}], "bottoms": [{"index": 7, "price": 1.08450, "time": 1767400500}]}', '{"peak_1": [{"index": 12, "value": 1.08570}], "bottom_1": [{"index": 7, "value": 1.08450}]}', '{"ascending_1": [{"start_index": 7, "start_value": 1.08450, "end_index": 12, "end_value": 1.08570}]}', '[]', '{"ultra_extreme_upper": 1.0903, "extreme_upper": 1.0893, "upper_most": 1.0883, "upper": 1.0873, "upper_middle": 1.0863, "lower_middle": 1.0843, "lower": 1.0833, "lower_most": 1.0823, "extreme_lower": 1.0813, "ultra_extreme_lower": 1.0803}', 1.08550, 1.08548, 1.08540, '{"peaks": [{"index": 12, "price": 1.08570, "time": 1767402000}], "bottoms": [{"index": 7, "price": 1.08450, "time": 1767400500}]}'),
(1767402600, 1.08555, 1.08560, 1.08530, 1.08535, NULL, NULL, NULL, NULL, NULL, 1.08545, 1.08542, 1.08538, NULL),
(1767402900, 1.08535, 1.08545, 1.08520, 1.08525, NULL, NULL, NULL, NULL, NULL, 1.08535, 1.08532, 1.08530, NULL),
(1767403200, 1.08525, 1.08535, 1.08510, 1.08520, NULL, NULL, NULL, NULL, NULL, 1.08525, 1.08522, 1.08522, NULL),
(1767403500, 1.08520, 1.08530, 1.08505, 1.08510, NULL, NULL, NULL, NULL, NULL, 1.08518, 1.08515, 1.08518, NULL),
(1767403800, 1.08510, 1.08525, 1.08500, 1.08520, NULL, NULL, NULL, NULL, NULL, 1.08515, 1.08512, 1.08516, NULL),
(1767404100, 1.08520, 1.08540, 1.08515, 1.08535, NULL, NULL, NULL, NULL, NULL, 1.08525, 1.08522, 1.08520, NULL),
(1767404400, 1.08535, 1.08550, 1.08530, 1.08545, NULL, NULL, NULL, NULL, NULL, 1.08538, 1.08535, 1.08528, NULL),
(1767404700, 1.08545, 1.08560, 1.08540, 1.08555, NULL, NULL, NULL, NULL, NULL, 1.08548, 1.08545, 1.08535, NULL),
(1767405000, 1.08555, 1.08570, 1.08550, 1.08560, NULL, NULL, NULL, NULL, NULL, 1.08555, 1.08552, 1.08542, NULL),
(1767405300, 1.08560, 1.08575, 1.08555, 1.08570, NULL, NULL, NULL, NULL, NULL, 1.08562, 1.08560, 1.08548, NULL),
(1767405600, 1.08570, 1.08580, 1.08560, 1.08575, NULL, NULL, NULL, NULL, NULL, 1.08570, 1.08568, 1.08555, NULL),

-- Candles 02:00 to 04:00 (24 more candles for H1 boundary testing)
(1767405900, 1.08575, 1.08590, 1.08570, 1.08585, NULL, NULL, NULL, NULL, NULL, 1.08578, 1.08575, 1.08562, NULL),
(1767406200, 1.08585, 1.08600, 1.08580, 1.08595, NULL, NULL, NULL, NULL, NULL, 1.08588, 1.08585, 1.08570, NULL),
(1767406500, 1.08595, 1.08610, 1.08590, 1.08605, NULL, NULL, NULL, NULL, NULL, 1.08598, 1.08595, 1.08578, NULL),
(1767406800, 1.08605, 1.08615, 1.08595, 1.08600, NULL, NULL, NULL, NULL, NULL, 1.08602, 1.08600, 1.08585, NULL),
(1767407100, 1.08600, 1.08610, 1.08585, 1.08590, NULL, NULL, NULL, NULL, NULL, 1.08598, 1.08595, 1.08588, NULL),
(1767407400, 1.08590, 1.08600, 1.08575, 1.08580, NULL, NULL, NULL, NULL, NULL, 1.08590, 1.08588, 1.08588, NULL),
(1767407700, 1.08580, 1.08590, 1.08565, 1.08570, NULL, NULL, NULL, NULL, NULL, 1.08582, 1.08580, 1.08585, NULL),
(1767408000, 1.08570, 1.08580, 1.08555, 1.08560, NULL, NULL, NULL, NULL, NULL, 1.08572, 1.08570, 1.08580, NULL),
(1767408300, 1.08560, 1.08575, 1.08550, 1.08565, NULL, NULL, NULL, NULL, NULL, 1.08565, 1.08562, 1.08576, NULL),
(1767408600, 1.08565, 1.08580, 1.08560, 1.08575, NULL, NULL, NULL, NULL, NULL, 1.08568, 1.08565, 1.08575, NULL),
(1767408900, 1.08575, 1.08590, 1.08570, 1.08585, NULL, NULL, NULL, NULL, NULL, 1.08578, 1.08575, 1.08576, NULL),
(1767409200, 1.08585, 1.08600, 1.08580, 1.08595, NULL, NULL, NULL, NULL, NULL, 1.08588, 1.08585, 1.08578, NULL),
(1767409500, 1.08595, 1.08610, 1.08590, 1.08600, NULL, NULL, NULL, NULL, NULL, 1.08595, 1.08592, 1.08580, NULL),
(1767409800, 1.08600, 1.08615, 1.08595, 1.08610, NULL, NULL, NULL, NULL, NULL, 1.08602, 1.08600, 1.08585, NULL),
(1767410100, 1.08610, 1.08625, 1.08605, 1.08620, NULL, NULL, NULL, NULL, NULL, 1.08612, 1.08610, 1.08590, NULL),
(1767410400, 1.08620, 1.08635, 1.08615, 1.08630, NULL, NULL, NULL, NULL, NULL, 1.08622, 1.08620, 1.08598, NULL),
(1767410700, 1.08630, 1.08645, 1.08625, 1.08640, NULL, NULL, NULL, NULL, NULL, 1.08632, 1.08630, 1.08605, NULL),
(1767411000, 1.08640, 1.08655, 1.08635, 1.08650, NULL, NULL, NULL, NULL, NULL, 1.08642, 1.08640, 1.08615, NULL),
(1767411300, 1.08650, 1.08660, 1.08640, 1.08655, NULL, NULL, NULL, NULL, NULL, 1.08650, 1.08648, 1.08622, NULL),
(1767411600, 1.08655, 1.08665, 1.08645, 1.08660, NULL, NULL, NULL, NULL, NULL, 1.08655, 1.08652, 1.08630, NULL),
(1767411900, 1.08660, 1.08670, 1.08650, 1.08665, NULL, NULL, NULL, NULL, NULL, 1.08660, 1.08658, 1.08638, NULL),
(1767412200, 1.08665, 1.08675, 1.08655, 1.08670, NULL, NULL, NULL, NULL, NULL, 1.08665, 1.08662, 1.08645, NULL),
(1767412500, 1.08670, 1.08680, 1.08660, 1.08675, NULL, NULL, NULL, NULL, NULL, 1.08670, 1.08668, 1.08652, NULL),
(1767412800, 1.08675, 1.08685, 1.08665, 1.08680, NULL, NULL, NULL, NULL, NULL, 1.08675, 1.08672, 1.08658, NULL),

-- Continue to 100 rows (04:00 to 08:20) - 49 more candles
(1767413100, 1.08680, 1.08690, 1.08670, 1.08685, NULL, NULL, NULL, NULL, NULL, 1.08680, 1.08678, 1.08665, NULL),
(1767413400, 1.08685, 1.08695, 1.08675, 1.08690, NULL, NULL, NULL, NULL, NULL, 1.08685, 1.08682, 1.08670, NULL),
(1767413700, 1.08690, 1.08700, 1.08680, 1.08695, NULL, NULL, NULL, NULL, NULL, 1.08690, 1.08688, 1.08676, NULL),
(1767414000, 1.08695, 1.08705, 1.08685, 1.08700, NULL, NULL, NULL, NULL, NULL, 1.08695, 1.08692, 1.08682, NULL),
(1767414300, 1.08700, 1.08710, 1.08690, 1.08705, NULL, NULL, NULL, NULL, NULL, 1.08700, 1.08698, 1.08688, NULL),
(1767414600, 1.08705, 1.08715, 1.08695, 1.08710, NULL, NULL, NULL, NULL, NULL, 1.08705, 1.08702, 1.08692, NULL),
(1767414900, 1.08710, 1.08720, 1.08700, 1.08715, NULL, NULL, NULL, NULL, NULL, 1.08710, 1.08708, 1.08698, NULL),
(1767415200, 1.08715, 1.08725, 1.08705, 1.08720, NULL, NULL, NULL, NULL, NULL, 1.08715, 1.08712, 1.08702, NULL),
(1767415500, 1.08720, 1.08730, 1.08710, 1.08725, NULL, NULL, NULL, NULL, NULL, 1.08720, 1.08718, 1.08708, NULL),
(1767415800, 1.08725, 1.08735, 1.08715, 1.08730, NULL, NULL, NULL, NULL, NULL, 1.08725, 1.08722, 1.08712, NULL),
(1767416100, 1.08730, 1.08740, 1.08720, 1.08735, NULL, NULL, NULL, NULL, NULL, 1.08730, 1.08728, 1.08718, NULL),
(1767416400, 1.08735, 1.08745, 1.08725, 1.08740, NULL, NULL, NULL, NULL, NULL, 1.08735, 1.08732, 1.08722, NULL),
(1767416700, 1.08740, 1.08750, 1.08730, 1.08745, NULL, NULL, NULL, NULL, NULL, 1.08740, 1.08738, 1.08728, NULL),
(1767417000, 1.08745, 1.08755, 1.08735, 1.08750, NULL, NULL, NULL, NULL, NULL, 1.08745, 1.08742, 1.08732, NULL),
(1767417300, 1.08750, 1.08760, 1.08740, 1.08755, NULL, NULL, NULL, NULL, NULL, 1.08750, 1.08748, 1.08738, NULL),
(1767417600, 1.08755, 1.08765, 1.08745, 1.08760, NULL, NULL, NULL, NULL, NULL, 1.08755, 1.08752, 1.08742, NULL),
(1767417900, 1.08760, 1.08770, 1.08750, 1.08765, NULL, NULL, NULL, NULL, NULL, 1.08760, 1.08758, 1.08748, NULL),
(1767418200, 1.08765, 1.08775, 1.08755, 1.08770, NULL, NULL, NULL, NULL, NULL, 1.08765, 1.08762, 1.08752, NULL),
(1767418500, 1.08770, 1.08780, 1.08760, 1.08775, NULL, NULL, NULL, NULL, NULL, 1.08770, 1.08768, 1.08758, NULL),
(1767418800, 1.08775, 1.08785, 1.08765, 1.08780, NULL, NULL, NULL, NULL, NULL, 1.08775, 1.08772, 1.08762, NULL),
(1767419100, 1.08780, 1.08790, 1.08770, 1.08785, NULL, NULL, NULL, NULL, NULL, 1.08780, 1.08778, 1.08768, NULL),
(1767419400, 1.08785, 1.08795, 1.08775, 1.08790, NULL, NULL, NULL, NULL, NULL, 1.08785, 1.08782, 1.08772, NULL),
(1767419700, 1.08790, 1.08800, 1.08780, 1.08795, NULL, NULL, NULL, NULL, NULL, 1.08790, 1.08788, 1.08778, NULL),
(1767420000, 1.08795, 1.08805, 1.08785, 1.08800, NULL, NULL, NULL, NULL, NULL, 1.08795, 1.08792, 1.08782, NULL),
(1767420300, 1.08800, 1.08810, 1.08790, 1.08805, NULL, NULL, NULL, NULL, NULL, 1.08800, 1.08798, 1.08788, NULL),
(1767420600, 1.08805, 1.08815, 1.08795, 1.08810, NULL, NULL, NULL, NULL, NULL, 1.08805, 1.08802, 1.08792, NULL),
(1767420900, 1.08810, 1.08820, 1.08800, 1.08815, NULL, NULL, NULL, NULL, NULL, 1.08810, 1.08808, 1.08798, NULL),
(1767421200, 1.08815, 1.08825, 1.08805, 1.08820, NULL, NULL, NULL, NULL, NULL, 1.08815, 1.08812, 1.08802, NULL),
(1767421500, 1.08820, 1.08830, 1.08810, 1.08825, NULL, NULL, NULL, NULL, NULL, 1.08820, 1.08818, 1.08808, NULL),
(1767421800, 1.08825, 1.08835, 1.08815, 1.08830, NULL, NULL, NULL, NULL, NULL, 1.08825, 1.08822, 1.08812, NULL),
(1767422100, 1.08830, 1.08840, 1.08820, 1.08835, NULL, NULL, NULL, NULL, NULL, 1.08830, 1.08828, 1.08818, NULL),
(1767422400, 1.08835, 1.08845, 1.08825, 1.08840, NULL, NULL, NULL, NULL, NULL, 1.08835, 1.08832, 1.08822, NULL),
(1767422700, 1.08840, 1.08850, 1.08830, 1.08845, NULL, NULL, NULL, NULL, NULL, 1.08840, 1.08838, 1.08828, NULL),
(1767423000, 1.08845, 1.08855, 1.08835, 1.08850, NULL, NULL, NULL, NULL, NULL, 1.08845, 1.08842, 1.08832, NULL),
(1767423300, 1.08850, 1.08860, 1.08840, 1.08855, NULL, NULL, NULL, NULL, NULL, 1.08850, 1.08848, 1.08838, NULL),
(1767423600, 1.08855, 1.08865, 1.08845, 1.08860, NULL, NULL, NULL, NULL, NULL, 1.08855, 1.08852, 1.08842, NULL),
(1767423900, 1.08860, 1.08870, 1.08850, 1.08865, NULL, NULL, NULL, NULL, NULL, 1.08860, 1.08858, 1.08848, NULL),
(1767424200, 1.08865, 1.08875, 1.08855, 1.08870, NULL, NULL, NULL, NULL, NULL, 1.08865, 1.08862, 1.08852, NULL),
(1767424500, 1.08870, 1.08880, 1.08860, 1.08875, NULL, NULL, NULL, NULL, NULL, 1.08870, 1.08868, 1.08858, NULL),
(1767424800, 1.08875, 1.08885, 1.08865, 1.08880, NULL, NULL, NULL, NULL, NULL, 1.08875, 1.08872, 1.08862, NULL),
(1767425100, 1.08880, 1.08890, 1.08870, 1.08885, NULL, NULL, NULL, NULL, NULL, 1.08880, 1.08878, 1.08868, NULL),
(1767425400, 1.08885, 1.08895, 1.08875, 1.08890, NULL, NULL, NULL, NULL, NULL, 1.08885, 1.08882, 1.08872, NULL),
(1767425700, 1.08890, 1.08900, 1.08880, 1.08895, NULL, NULL, NULL, NULL, NULL, 1.08890, 1.08888, 1.08878, NULL),
(1767426000, 1.08895, 1.08905, 1.08885, 1.08900, NULL, NULL, NULL, NULL, NULL, 1.08895, 1.08892, 1.08882, NULL),
(1767426300, 1.08900, 1.08910, 1.08890, 1.08905, NULL, NULL, NULL, NULL, NULL, 1.08900, 1.08898, 1.08888, NULL),
(1767426600, 1.08905, 1.08915, 1.08895, 1.08910, NULL, NULL, NULL, NULL, NULL, 1.08905, 1.08902, 1.08892, NULL),
(1767426900, 1.08910, 1.08920, 1.08900, 1.08915, NULL, NULL, NULL, NULL, NULL, 1.08910, 1.08908, 1.08898, NULL),
(1767427200, 1.08915, 1.08925, 1.08905, 1.08920, NULL, NULL, NULL, NULL, NULL, 1.08915, 1.08912, 1.08902, NULL);


-- ============================================================================
-- POSTGRESQL SEED DATA (for eurusd_h1 table)
-- Same data but filtered for H1 timeframe (only rows at :00 minutes)
-- ============================================================================

-- Note: Use this section to insert into PostgreSQL directly for testing
-- Run after postgresql_schema.sql

-- INSERT INTO eurusd_h1 (timestamp, open, high, low, close, fractals, horizontal_trendlines, diagonal_trendlines, momentum_candles, keltner_channels, tema, hrma, smma, zigzag)
-- SELECT
--     to_timestamp(timestamp) AT TIME ZONE 'UTC',
--     open, high, low, close,
--     fractals::jsonb, horizontal_trendlines::jsonb, diagonal_trendlines::jsonb,
--     momentum_candles::jsonb, keltner_channels::jsonb, tema, hrma, smma, zigzag::jsonb
-- FROM (VALUES
--     (1767398400, 1.08500, 1.08560, 1.08480, 1.08555, ...)  -- 00:00
--     (1767402000, 1.08540, 1.08570, 1.08500, 1.08565, ...)  -- 01:00
--     (1767405600, 1.08570, 1.08600, 1.08555, 1.08595, ...)  -- 02:00
--     (1767409200, 1.08585, 1.08630, 1.08580, 1.08625, ...)  -- 03:00
--     ...
-- ) AS seed(timestamp, open, high, low, close, ...);


-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify SQLite seed data count
-- SELECT COUNT(*) AS row_count FROM EURUSD;
-- Expected: 100

-- Verify timestamp range
-- SELECT
--     datetime(MIN(timestamp), 'unixepoch') AS first_timestamp,
--     datetime(MAX(timestamp), 'unixepoch') AS last_timestamp
-- FROM EURUSD;
-- Expected: 2026-01-03 00:00:00 to 2026-01-03 08:00:00

-- Verify OHLC data validity
-- SELECT * FROM EURUSD WHERE close > high OR close < low OR open > high OR open < low;
-- Expected: 0 rows (no invalid data)

-- Verify JSON data
-- SELECT timestamp, json_valid(fractals) as valid_fractals FROM EURUSD WHERE fractals IS NOT NULL LIMIT 5;
-- Expected: All 1 (valid JSON)
