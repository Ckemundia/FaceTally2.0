# routes/units.py
from fastapi import APIRouter, HTTPException
from db import get_units, get_student_units

router = APIRouter()

@router.get("/units")
def list_units():
    """
    ✅ Return all available units (admin or lecturer view).
    """
    try:
        units = get_units()
        return {"units": units}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not fetch units: {str(e)}")


@router.get("/units/myunits/{student_id}")
def list_my_units(student_id: str):
    """
    ✅ Return only the units assigned to a specific student,
       including their active status.
    """
    try:
        units = get_student_units(student_id)

        if not units:
            raise HTTPException(
                status_code=404,
                detail=f"No units found for student {student_id}"
            )

        return {"units": units}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Could not fetch student units: {str(e)}"
        )
