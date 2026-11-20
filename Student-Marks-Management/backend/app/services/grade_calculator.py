"""
Grade Calculator Service
Implements calculate_total, calculate_percentage, calculate_average,
calculate_grade, find_highest_marks, and find_lowest_marks using Python Lists and Tuples.
"""

from __future__ import annotations

from typing import List, Tuple
from app.utils.python_data_structures import GRADE_RANGES


def calculate_total(marks_list: List[float]) -> float:
    """Sum a Python list of numeric marks."""
    if not marks_list:
        return 0.0
    return round(sum(float(m) for m in marks_list), 2)


def calculate_average(marks_list: List[float]) -> float:
    """Compute arithmetic mean of a Python list of marks."""
    if not marks_list:
        return 0.0
    return round(sum(float(m) for m in marks_list) / len(marks_list), 2)


def calculate_percentage(obtained_marks: float, maximum_marks: float) -> float:
    """Compute percentage = (Obtained / Maximum) * 100."""
    if maximum_marks <= 0:
        return 0.0
    return round((float(obtained_marks) / float(maximum_marks)) * 100.0, 2)


def calculate_grade(
    percentage: float,
    grade_ranges: Tuple[Tuple[float, str, str], ...] = GRADE_RANGES,
) -> Tuple[str, str]:
    """
    Determine letter grade and descriptor using immutable GRADE_RANGES tuple.
    Returns (grade, descriptor) tuple.
    """
    for min_threshold, grade, label in grade_ranges:
        if percentage >= min_threshold:
            return (grade, label)
    return ("F", "Needs Improvement")


def find_highest_marks(marks_list: List[float]) -> float:
    """Return highest mark in a Python list."""
    if not marks_list:
        return 0.0
    return round(max(float(m) for m in marks_list), 2)


def find_lowest_marks(marks_list: List[float]) -> float:
    """Return lowest mark in a Python list."""
    if not marks_list:
        return 0.0
    return round(min(float(m) for m in marks_list), 2)
