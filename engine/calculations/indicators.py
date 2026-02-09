"""
Technical indicator helper functions.
Used by RADAR and structural analysis calculations.
"""
import numpy as np
from typing import Union
from scipy import stats


def sma(data: Union[list, np.ndarray], period: int) -> np.ndarray:
    """
    Simple Moving Average.

    Args:
        data: Price data array
        period: SMA period

    Returns:
        Array of SMA values (NaN for first period-1 values)
    """
    data = np.asarray(data, dtype=float)
    result = np.full(len(data), np.nan)

    for i in range(period - 1, len(data)):
        result[i] = np.mean(data[i - period + 1:i + 1])

    return result


def ema(data: Union[list, np.ndarray], period: int) -> np.ndarray:
    """
    Exponential Moving Average.

    Args:
        data: Price data array
        period: EMA period

    Returns:
        Array of EMA values
    """
    data = np.asarray(data, dtype=float)
    alpha = 2 / (period + 1)
    result = np.zeros(len(data))
    result[0] = data[0]

    for i in range(1, len(data)):
        result[i] = alpha * data[i] + (1 - alpha) * result[i - 1]

    return result


def stdev(data: Union[list, np.ndarray], period: int) -> np.ndarray:
    """
    Rolling Standard Deviation.

    Args:
        data: Price data array
        period: Lookback period

    Returns:
        Array of standard deviation values
    """
    data = np.asarray(data, dtype=float)
    result = np.full(len(data), np.nan)

    for i in range(period - 1, len(data)):
        result[i] = np.std(data[i - period + 1:i + 1], ddof=1)

    return result


def percentile_rank(data: Union[list, np.ndarray], lookback: int) -> np.ndarray:
    """
    Calculate percentile rank of current value within lookback window.

    Args:
        data: Data array
        lookback: Lookback period for percentile calculation

    Returns:
        Array of percentile values (0-100)
    """
    data = np.asarray(data, dtype=float)
    result = np.full(len(data), np.nan)

    for i in range(lookback - 1, len(data)):
        window = data[i - lookback + 1:i + 1]
        current = data[i]
        result[i] = stats.percentileofscore(window, current, kind='rank')

    return result


def highest(data: Union[list, np.ndarray], period: int) -> np.ndarray:
    """
    Rolling highest value.

    Args:
        data: Data array
        period: Lookback period

    Returns:
        Array of highest values in rolling window
    """
    data = np.asarray(data, dtype=float)
    result = np.full(len(data), np.nan)

    for i in range(period - 1, len(data)):
        result[i] = np.max(data[i - period + 1:i + 1])

    return result


def lowest(data: Union[list, np.ndarray], period: int) -> np.ndarray:
    """
    Rolling lowest value.

    Args:
        data: Data array
        period: Lookback period

    Returns:
        Array of lowest values in rolling window
    """
    data = np.asarray(data, dtype=float)
    result = np.full(len(data), np.nan)

    for i in range(period - 1, len(data)):
        result[i] = np.min(data[i - period + 1:i + 1])

    return result


def gaussian_weights(length: int) -> np.ndarray:
    """
    Generate Gaussian kernel weights.

    Args:
        length: Number of weights

    Returns:
        Normalized Gaussian weights array
    """
    sigma = length / 4
    center = length / 2
    weights = np.array([
        np.exp(-((i - center) ** 2) / (2 * sigma ** 2))
        for i in range(length)
    ])
    return weights / np.sum(weights)


def weighted_average(data: Union[list, np.ndarray], weights: np.ndarray) -> float:
    """
    Calculate weighted average.

    Args:
        data: Data array
        weights: Weights array (same length as data)

    Returns:
        Weighted average value
    """
    data = np.asarray(data, dtype=float)
    return np.sum(data * weights)


def crossover(series1: np.ndarray, series2: np.ndarray) -> np.ndarray:
    """
    Detect crossover (series1 crosses above series2).

    Args:
        series1: First data series
        series2: Second data series

    Returns:
        Boolean array where True indicates crossover
    """
    result = np.full(len(series1), False)
    for i in range(1, len(series1)):
        if series1[i - 1] <= series2[i - 1] and series1[i] > series2[i]:
            result[i] = True
    return result


def crossunder(series1: np.ndarray, series2: np.ndarray) -> np.ndarray:
    """
    Detect crossunder (series1 crosses below series2).

    Args:
        series1: First data series
        series2: Second data series

    Returns:
        Boolean array where True indicates crossunder
    """
    result = np.full(len(series1), False)
    for i in range(1, len(series1)):
        if series1[i - 1] >= series2[i - 1] and series1[i] < series2[i]:
            result[i] = True
    return result


def bollinger_bands(
    close: Union[list, np.ndarray],
    period: int = 20,
    mult: float = 2.0
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Calculate Bollinger Bands.

    Args:
        close: Close prices
        period: MA period
        mult: Standard deviation multiplier

    Returns:
        Tuple of (upper_band, middle_band, lower_band)
    """
    close = np.asarray(close, dtype=float)
    middle = sma(close, period)
    std = stdev(close, period)
    upper = middle + (mult * std)
    lower = middle - (mult * std)

    return upper, middle, lower
