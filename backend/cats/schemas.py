from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema

cat_public_id_parameter = OpenApiParameter(
    name="public_id",
    type=OpenApiTypes.UUID,
    location=OpenApiParameter.PATH,
    description="Публичный UUID кота.",
)


cat_view_schema = {
    "retrieve": extend_schema(parameters=[cat_public_id_parameter]),
    "partial_update": extend_schema(parameters=[cat_public_id_parameter]),
    "destroy": extend_schema(parameters=[cat_public_id_parameter]),
}
