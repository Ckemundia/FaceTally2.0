# routes/units.py
from fastapi import APIRouter, HTTPException
from db import get_units, get_student_units

router = APIRouter()

@router.get("/units")
def list_units():
    """Return all available units."""
    return {"units": get_units()}


@router.get("/units/myunits/{student_id}")
def list_my_units(student_id: str):
    """Return only the units assigned to a specific student."""
    try:
        units = get_student_units(student_id)
        return {"units": units}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not fetch student units: {str(e)}")
