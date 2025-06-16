
# Register DMABN blueprint
def register_dmabn_routes(app):
    """Register DMABN analysis routes"""
    from app.routes.dmabn_analysis import dmabn_bp
    app.register_blueprint(dmabn_bp)