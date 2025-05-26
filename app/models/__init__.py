# app/models/__init__.py

# Import only what exists and works
try:
    from .trajectory import TrajectoryProcessor
except ImportError:
    TrajectoryProcessor = None

try:
    from .excitation import ExcitationProcessor
except ImportError:
    ExcitationProcessor = None

try:
    from .analysis import MolecularAnalysis
except ImportError:
    MolecularAnalysis = None

# Only export what was successfully imported
__all__ = []
if TrajectoryProcessor:
    __all__.append('TrajectoryProcessor')
if ExcitationProcessor:
    __all__.append('ExcitationProcessor')
if MolecularAnalysis:
    __all__.append('MolecularAnalysis')