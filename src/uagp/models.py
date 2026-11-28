"""Contracts. Federated signals deliberately have no free-text fields."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

Category = Literal["transport", "energy", "services", "other"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class DraftInput(StrictModel):
    category: Category
    problem: str = Field(min_length=8, max_length=2000)
    desired_outcome: str = Field(min_length=8, max_length=2000)


class Confirmation(StrictModel):
    share_federated: bool = False


class EventData(StrictModel):
    signal: Literal["problem_category"]
    category: Category


class FederationEvent(StrictModel):
    specversion: Literal["1.0"]
    id: UUID
    source: str
    type: Literal["ua.gov.problem.signal.v1"]
    time: datetime
    datacontenttype: Literal["application/json"]
    data: EventData


class DemoPolicy(StrictModel):
    policy_id: str = Field(min_length=1, max_length=120)
    version: str
    allowed_tools: list[str]
    risk_ceiling: int = Field(ge=0, le=3)
    valid_until: datetime


class PolicyCheck(StrictModel):
    policy: DemoPolicy
    signature: str
    tool_id: str
    risk_class: int = Field(ge=0, le=4)
    human_approved: bool = False
